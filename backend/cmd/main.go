package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/streadway/amqp"

	"backend/internal/address"
	"backend/internal/backup"
	"backend/internal/db"
	"backend/internal/equipment"
	"backend/internal/files"
	"backend/internal/inventory"
	"backend/internal/report"
	"backend/internal/requests"
	"backend/internal/storage"
	"backend/internal/tickets"
	"backend/internal/travelsheet"
	"backend/internal/users"
)

func init() {
	if err := godotenv.Load(); err != nil {
		panic("No .env file found")
	}
	ginMode, exists := os.LookupEnv("GIN_MODE")
	if !exists {
		panic("GIN_MODE not found in .env file")
	}
	if ginMode == "release" {
		gin.SetMode(gin.ReleaseMode)
		serverMode = "RELEASE"
	} else {
		serverMode = "DEBUG"
	}
}

var serverMode string

func createRequiredDirectories() {
	dirs := []string{
		"uploads/files",
		"uploads/reports",
		"uploads/previews",
	}

	for _, dir := range dirs {
		err := os.MkdirAll(dir, 0755)
		if err != nil {
			log.Fatalf("Ошибка при создании директории %s: %v", dir, err)
		}
	}
}

func main() {
	createRequiredDirectories()

	db.InitDB()

	_ = storage.InitS3FromEnv()

	backup.StartScheduledBackups()

	r := gin.Default()
	r.MaxMultipartMemory = 8 << 30 // 8 GiB

	conn, err := amqp.Dial("amqp://guest:guest@localhost:5672/")
	if err != nil {
		log.Fatalf("Ошибка подключения к RabbitMQ: %v", err)
	}
	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("Ошибка создания канала RabbitMQ: %v", err)
	}
	tickets.TicketQueue = ch
	go tickets.StartTicketWorker("amqp://guest:guest@localhost:5672/")

	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{
			"https://crmlite-vv.ru",
			"https://77.239.113.150:3000",
			"http://localhost:3000",
		},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{
			"Origin",
			"Content-Type",
			"Accept",
			"Authorization",
			"X-Requested-With",
		},
		ExposeHeaders:    []string{"Content-Length", "Set-Cookie"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Сертификаты
	r.GET("/api/files", users.AuthMiddleware(), files.GetFiles)
	r.POST("/api/files", users.AuthMiddleware(), files.UploadFiles)
	r.GET("/api/files/preview/:filename", files.PreviewFiles)
	r.GET("/api/files/download/:filename", users.AuthMiddleware(), files.DownloadFiles)
	r.PUT("/api/files/rename", users.AuthMiddleware(), files.RenameFiles)
	r.DELETE("/api/files/delete/:filename", users.AuthMiddleware(), files.DeleteFiles)
	r.GET("/api/files/search", users.AuthMiddleware(), files.SearchFiles)

	// Пользователь
	r.POST("/api/register", users.Register)
	r.POST("/api/login", users.Login)
	r.POST("/api/logout", users.Logout)
	r.GET("/api/check-auth", users.CheckAuth)
	r.GET("/api/users", users.AuthMiddleware(), users.GetUsers)
	r.PUT("/api/profile", users.AuthMiddleware(), users.UpdateProfile)

	// Администрирование пользователей
	r.GET(
		"/api/allowed-phones",
		users.AuthMiddleware(),
		users.AdminMiddleware(),
		users.GetAllowedPhones,
	)
	r.POST(
		"/api/allowed-phones",
		users.AuthMiddleware(),
		users.AdminMiddleware(),
		users.AddAllowedPhone,
	)
	r.DELETE(
		"/api/allowed-phones/:phone",
		users.AuthMiddleware(),
		users.AdminMiddleware(),
		users.RemoveAllowedPhone,
	)
	r.PUT("/api/users/:id", users.AuthMiddleware(), users.AdminMiddleware(), users.UpdateUser)
	r.DELETE("/api/users/:id", users.AuthMiddleware(), users.AdminMiddleware(), users.DeleteUser)

	// Отчеты
	r.GET("/uploads/reports/:filename", report.ServeReportFile)
	r.POST("/api/report", users.AuthMiddleware(), report.CreateReport)
	r.GET("/api/reports", users.AuthMiddleware(), report.GetReportsHandler)
	r.GET("/api/reports/monthly-zip", users.AuthMiddleware(), report.DownloadMonthlyReports)
	r.GET("/api/reports/period-zip", users.AuthMiddleware(), report.DownloadReportsByPeriod)
	r.POST("/api/reports/download-selected", users.AuthMiddleware(), report.DownloadSelectedReports)
	r.DELETE("/api/reports/:reportname", users.AuthMiddleware(), report.DeleteReport)
	r.POST(
		"/api/reports/upload",
		users.AuthMiddleware(),
		users.AdminMiddleware(),
		report.UploadReport,
	)
	r.POST("/api/reports/upload-multiple", users.AuthMiddleware(), users.AdminMiddleware(), report.UploadMultipleReports)
	r.GET("/api/reportscount", users.AuthMiddleware(), report.GetReportsCount)
	r.GET("/api/reports/preview/:filename", users.AuthMiddleware(), report.PreviewReport)
	r.GET("/api/reports/preview-image/:filename", users.AuthMiddleware(), report.PreviewReportImage)

	// График
	r.GET("/api/requests", users.AuthMiddleware(), requests.GetRequests)
	r.GET("/api/requests/:id", users.AuthMiddleware(), requests.GetRequestById)
	r.POST("/api/requests", users.AuthMiddleware(), requests.CreateRequest)
	r.PUT("/api/requests/:id", users.AuthMiddleware(), requests.UpdateRequest)
	r.DELETE("/api/requests/:id", users.AuthMiddleware(), requests.DeleteReport)

	// Заявки клиентов
	r.POST("/api/client-tickets", tickets.CreateTicket)
	r.GET("/api/client-tickets", users.AuthMiddleware(), tickets.GetClientTickets)
	r.PUT("/api/client-tickets/:id", users.AuthMiddleware(), tickets.UpdateClientTicket)
	r.DELETE("/api/client-tickets/:id", users.AuthMiddleware(), tickets.DeleteClientTicket)
	r.GET("/api/tickets/files/:filename", tickets.ServeTicketFile)

	// Адреса объектов
	r.GET("/api/addresses", address.GetAddresses)
	r.POST("/api/addresses", users.AuthMiddleware(), address.AddAddress)
	r.DELETE("/api/addresses/:id", users.AuthMiddleware(), address.DeleteAddress)

	// Список оборудования
	r.GET("/api/equipment", equipment.GetEquipment)
	r.POST("/api/equipment", users.AuthMiddleware(), equipment.AddEquipment)
	r.DELETE("/api/equipment/:id", users.AuthMiddleware(), equipment.DeleteEquipment)

	// Запоминание оборудования по объектам
	r.GET("/api/equipment/memory", users.AuthMiddleware(), equipment.GetEquipmentMemory)
	r.POST("/api/equipment/memory", users.AuthMiddleware(), equipment.SaveEquipmentMemory)

	// Список покупок (инвентарь)
	r.GET("/api/inventory", users.AuthMiddleware(), inventory.GetInventory)
	r.POST("/api/inventory", users.AuthMiddleware(), inventory.AddInventoryItem)
	r.GET("/api/inventory/:id", users.AuthMiddleware(), inventory.GetItemById)
	r.PUT("/api/inventory/:id", users.AuthMiddleware(), inventory.UpdateInventoryItem)
	r.DELETE("/api/inventory/:id", users.AuthMiddleware(), inventory.DeleteInventoryItem)

	// Путевой лист
	r.GET("/api/travel-sheet", users.AuthMiddleware(), travelsheet.GetTravelRecords)
	r.POST("/api/travel-sheet", users.AuthMiddleware(), travelsheet.CreateTravelRecord)
	r.DELETE("/api/travel-sheet/:id", users.AuthMiddleware(), travelsheet.DeleteTravelRecord)
	r.GET("/api/travel-sheet/stats/daily", users.AuthMiddleware(), travelsheet.GetDailyStats)
	r.GET("/api/travel-sheet/stats/monthly", users.AuthMiddleware(), travelsheet.GetMonthlyStats)

	// Статические файлы
	r.Static("/uploads/files", "./uploads/files")
	r.Static("/uploads/tickets", "./uploads/tickets")

	// Эндпоинт для проверки доступности сервера
	r.GET("/api/check-health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	switch serverMode {
	case "RELEASE":
		fmt.Println("Сервер запущен в режиме " + serverMode)
		log.Fatal(
			r.RunTLS(
				":8080",
				"/etc/letsencrypt/live/crmlite-vv.ru/fullchain.pem",
				"/etc/letsencrypt/live/crmlite-vv.ru/privkey.pem",
			),
		)
	case "DEBUG":
		fmt.Println("Сервер запущен в режиме " + serverMode)
		log.Fatal(r.Run(":8080"))
	default:
		panic("serverMode(gin) is not set")
	}
}
