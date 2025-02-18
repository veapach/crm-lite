package certificates

import (
	"crm-backend/internal/db"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

func GetCertificatesHandler(c *gin.Context) {
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

func UploadCertificateHandler(c *gin.Context) {
	form, _ := c.MultipartForm()
	files := form.File["file"]

	for _, file := range files {
		filePath := filepath.Join("uploads", "certificates", file.Filename)

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

func DownloadCertificateHandler(c *gin.Context) {
	filename := c.Param("filename")
	filePath := filepath.Join("uploads", "certificates", filename)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
		return
	}

	c.File(filePath)
}

func RenameCertificateHandler(c *gin.Context) {
	var request struct {
		OldName string `json:"oldName"`
		NewName string `json:"newName"`
	}
	if err := c.BindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат запроса"})
		return
	}

	oldPath := filepath.Join("uploads", "certificates", request.OldName)
	ext := filepath.Ext(request.OldName)
	newNameWithExt := request.NewName + ext
	newPath := filepath.Join("uploads", "certificates", newNameWithExt)

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

func DeleteCertificateHandler(c *gin.Context) {
	filename := c.Param("filename")
	filePath := filepath.Join("uploads", "certificates", filename)

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

func SearchCertificatesHandler(c *gin.Context) {
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
