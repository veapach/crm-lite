package main

import (
	"fmt"
	"log"

	"crm-backend/internal/certificates"
	"crm-backend/internal/db"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	db.InitDB()

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	r.GET("/api/certificates", certificates.GetCertificatesHandler)
	r.POST("/api/certificates", certificates.UploadCertificateHandler)
	r.GET("/api/download/:filename", certificates.DownloadCertificateHandler)
	r.PUT("/api/rename", certificates.RenameCertificateHandler)
	r.DELETE("/api/delete/:filename", certificates.DeleteCertificateHandler)
	r.GET("/api/search", certificates.SearchCertificatesHandler)

	fmt.Println("Сервер запущен на http://localhost:8080")
	log.Fatal(r.Run(":8080"))
}
