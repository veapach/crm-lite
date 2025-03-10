package files

import (
	"backend/internal/db"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

func GetFiles(c *gin.Context) {
	var certificates []db.Certificate
	if err := db.DB.Find(&certificates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении сертификатов"})
		return
	}

	var filenames []string
	for _, cert := range certificates {
		filenames = append(filenames, cert.Filename)
	}

	c.JSON(http.StatusOK, filenames)
}

func UploadFiles(c *gin.Context) {
	form, _ := c.MultipartForm()
	files := form.File["file"]

	for _, file := range files {
		filePath := filepath.Join("uploads", "files", file.Filename)

		if err := c.SaveUploadedFile(file, filePath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при сохранении файла"})
			return
		}

		certificate := db.Certificate{Filename: file.Filename}
		if err := db.DB.Create(&certificate).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при сохранении данных в БД"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Файлы успешно загружены"})
}

func PreviewFiles(c *gin.Context) {
	filename, err := url.QueryUnescape(c.Param("filename"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректное имя файла"})
		return
	}

	filePath := filepath.Join("uploads", "files", filename)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
		return
	}

	c.Header("Content-Type", "image/*")
	c.Header("Cache-Control", "public, max-age=31536000")
	c.File(filePath)
}

func DownloadFiles(c *gin.Context) {
	filename, err := url.QueryUnescape(c.Param("filename"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректное имя файла"})
		return
	}

	filePath := filepath.Join("uploads", "files", filename)

	c.Header("Access-Control-Allow-Origin", "http://crmlite-vv.ru")
	c.Header("Access-Control-Allow-Origin", "http://localhost:3000")
	c.Header("Access-Control-Allow-Methods", "GET, OPTIONS")

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
		return
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", url.PathEscape(filename)))
	c.Header("Content-Type", "application/octet-stream")

	c.File(filePath)
}

func RenameFiles(c *gin.Context) {
	var request struct {
		OldName string `json:"oldName"`
		NewName string `json:"newName"`
	}
	if err := c.BindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат запроса"})
		return
	}

	oldPath := filepath.Join("uploads", "files", request.OldName)
	ext := filepath.Ext(request.OldName)
	newNameWithExt := request.NewName + ext
	newPath := filepath.Join("uploads", "files", newNameWithExt)

	if _, err := os.Stat(oldPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
		return
	}

	if err := os.Rename(oldPath, newPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при переименовании файла"})
		return
	}

	if err := db.DB.Model(&db.Certificate{}).Where("filename = ?", request.OldName).Update("filename", newNameWithExt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при обновлении имени файла в БД"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Файл успешно переименован"})
}

func DeleteFiles(c *gin.Context) {
	filename := c.Param("filename")
	filePath := filepath.Join("uploads", "files", filename)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
		return
	}

	if err := os.Remove(filePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при удалении файла"})
		return
	}

	if err := db.DB.Where("filename = ?", filename).Delete(&db.Certificate{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при удалении данных из БД"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Файл успешно удален"})
}

func SearchFiles(c *gin.Context) {
	query := c.DefaultQuery("query", "")

	var certificates []db.Certificate
	if err := db.DB.Where("filename LIKE ?", "%"+query+"%").Find(&certificates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при поиске сертификатов"})
		return
	}

	var filenames []string
	for _, cert := range certificates {
		filenames = append(filenames, cert.Filename)
	}

	c.JSON(http.StatusOK, filenames)
}
