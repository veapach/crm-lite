package main

import (
	"fmt"
	"log"

	"crm-backend/internal/certificates"
	"crm-backend/internal/db"
	"crm-backend/internal/users"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	db.InitDB()

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://localhost:3001"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
		AllowHeaders:     []string{"Origin", "Authorization", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	r.GET("/api/certificates", certificates.GetCertificatesHandler)
	r.POST("/api/certificates", certificates.UploadCertificateHandler)
	r.GET("/api/download/:filename", certificates.DownloadCertificateHandler)
	r.PUT("/api/rename", certificates.RenameCertificateHandler)
	r.DELETE("/api/delete/:filename", certificates.DeleteCertificateHandler)
	r.GET("/api/search", certificates.SearchCertificatesHandler)

	r.POST("/api/register", users.Register)
	r.POST("/api/login", users.Login)
	r.GET("/api/check-auth", users.CheckAuth)

	r.PUT("/api/profile", users.UpdateProfile)

	fmt.Println("Сервер запущен на http://localhost:8080")
	log.Fatal(r.Run(":8080"))
}
