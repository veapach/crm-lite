package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type Certificate struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Filename string `gorm:"uniqueIndex" json:"filename"`
}

var db *gorm.DB

func initDB() {
	var err error
	db, err = gorm.Open(sqlite.Open("certificates.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Ошибка при подключении к БД:", err)
	}
	db.AutoMigrate(&Certificate{})
	os.MkdirAll("uploads", os.ModePerm)
}

func getCertificates(c *gin.Context) {
	var certificates []Certificate
	db.Find(&certificates)

	var filenames []string
	for _, cert := range certificates {
		filenames = append(filenames, cert.Filename)
	}

	c.JSON(http.StatusOK, filenames)
}

func uploadCertificate(c *gin.Context) {
	form, _ := c.MultipartForm()
	files := form.File["file"]

	for _, file := range files {
		filePath := filepath.Join("uploads", file.Filename)

		if err := c.SaveUploadedFile(file, filePath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при сохранении файла"})
			return
		}

		db.Create(&Certificate{Filename: file.Filename})
	}

	c.JSON(http.StatusOK, gin.H{"message": "Файлы успешно загружены"})
}

func downloadCertificate(c *gin.Context) {
	filename := c.Param("filename")
	filePath := filepath.Join("uploads", filename)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
		return
	}

	c.File(filePath)
}

func renameCertificate(c *gin.Context) {
	var request struct {
		OldName string `json:"oldName"`
		NewName string `json:"newName"`
	}
	if err := c.BindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат запроса"})
		return
	}

	oldPath := filepath.Join("uploads", request.OldName)
	ext := filepath.Ext(request.OldName)
	newNameWithExt := request.NewName + ext
	newPath := filepath.Join("uploads", newNameWithExt)

	if _, err := os.Stat(oldPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
		return
	}

	if err := os.Rename(oldPath, newPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при переименовании файла"})
		return
	}

	db.Model(&Certificate{}).Where("filename = ?", request.OldName).Update("filename", newNameWithExt)
	c.JSON(http.StatusOK, gin.H{"message": "Файл успешно переименован"})
}

func deleteCertificate(c *gin.Context) {
	filename := c.Param("filename")
	filePath := filepath.Join("uploads", filename)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
		return
	}

	if err := os.Remove(filePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при удалении файла"})
		return
	}

	db.Where("filename = ?", filename).Delete(&Certificate{})
	c.JSON(http.StatusOK, gin.H{"message": "Файл успешно удален"})
}

func searchCertificates(c *gin.Context) {
	query := c.DefaultQuery("query", "")
	var certificates []Certificate
	db.Where("filename LIKE ?", "%"+query+"%").Find(&certificates)

	var filenames []string
	for _, cert := range certificates {
		filenames = append(filenames, cert.Filename)
	}

	c.JSON(http.StatusOK, filenames)
}

func main() {
	initDB()
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	r.GET("/api/certificates", getCertificates)
	r.POST("/api/certificates", uploadCertificate)
	r.GET("/api/download/:filename", downloadCertificate)
	r.PUT("/api/rename", renameCertificate)
	r.DELETE("/api/delete/:filename", deleteCertificate)
	r.GET("/api/search", searchCertificates)

	fmt.Println("Сервер запущен на http://localhost:8080")
	r.Run(":8080")
}
