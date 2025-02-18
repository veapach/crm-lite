package main

import (
	"fmt"
	"log"
	"os"

	"crm-backend/internal/certificates"
	"crm-backend/internal/db"
	"crm-backend/internal/report"
	"crm-backend/internal/users"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func createRequiredDirectories() {
	dirs := []string{
		"uploads/certificates",
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
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Authorization", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	r.GET("/api/certificates", certificates.GetCertificatesHandler)
	r.POST("/api/certificates", certificates.UploadCertificateHandler)
	r.GET("/api/certificates/download/:filename", certificates.DownloadCertificateHandler)
	r.PUT("/api/certificates/rename", certificates.RenameCertificateHandler)
	r.DELETE("/api/certificates/delete/:filename", certificates.DeleteCertificateHandler)
	r.GET("/api/certificates/search", certificates.SearchCertificatesHandler)

	r.POST("/api/register", users.Register)
	r.POST("/api/login", users.Login)
	r.GET("/api/check-auth", users.CheckAuth)

	r.PUT("/api/profile", users.AuthMiddleware(), users.UpdateProfile)

	r.POST("/api/report", users.AuthMiddleware(), report.CreateReport)
	r.GET("/api/reports", users.AuthMiddleware(), report.GetReportsHandler)

	r.Static("/uploads/reports", "./uploads/reports")

	fmt.Println("Сервер запущен на http://localhost:8080")
	log.Fatal(r.Run(":8080"))
}
