package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"backend/internal/db"
	"backend/internal/files"
	"backend/internal/report"
	"backend/internal/requests"
	"backend/internal/users"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
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
		serverMode = "Сервер запущен в режиме RELEASE"
	} else {
		serverMode = "Сервер запущен в режиме DEBUG на http://localhost:8080"
	}
}

var serverMode string

func createRequiredDirectories() {
	dirs := []string{
		"uploads/files",
		"uploads/reports",
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

	r := gin.Default()

	fmt.Println(serverMode)

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://crmlite-vv.ru"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
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
	r.PUT("/api/profile", users.AuthMiddleware(), users.UpdateProfile)

	// Отчеты
	r.POST("/api/report", users.AuthMiddleware(), report.CreateReport)
	r.GET("/api/reports", users.AuthMiddleware(), report.GetReportsHandler)
	r.DELETE("/api/reports/:reportname", users.AuthMiddleware(), report.DeleteReport)

	// Заявки
	r.GET("/api/requests", users.AuthMiddleware(), requests.GetRequests)
	r.GET("/api/requests/:id", users.AuthMiddleware(), requests.GetRequestById)
	r.POST("/api/requests", users.AuthMiddleware(), requests.CreateRequest)
	r.PUT("/api/requests/:id", users.AuthMiddleware(), requests.UpdateRequest)
	r.DELETE("/api/requests/:id", users.AuthMiddleware(), requests.DeleteReport)

	// Статические файлы
	r.Static("/uploads/reports", "./uploads/reports")
	r.Static("/uploads/files", "./uploads/files")

	log.Fatal(r.Run(":8080"))
}
