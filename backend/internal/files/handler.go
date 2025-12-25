package files

import (
	"backend/internal/db"
	"backend/internal/storage"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

const filesPrefix = "files/"

func GetFiles(c *gin.Context) {
	var files []db.File
	if err := db.DB.Find(&files).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении сертификатов"})
		return
	}

	var filenames []string
	for _, cert := range files {
		filenames = append(filenames, cert.Filename)
	}

	c.JSON(http.StatusOK, filenames)
}

func UploadFiles(c *gin.Context) {
	form, _ := c.MultipartForm()
	files := form.File["file"]

	ctx := context.Background()

	for _, file := range files {
		src, err := file.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при открытии файла"})
			return
		}
		defer src.Close()

		filename := file.Filename
		contentType := file.Header.Get("Content-Type")
		if contentType == "" {
			contentType = "application/octet-stream"
		}

		if storage.IsS3Enabled() {
			// Получаем уникальное имя файла для S3
			uniqueName := storage.GetUniqueFileName(ctx, filesPrefix, filename)
			if err := storage.UploadObject(ctx, filesPrefix, uniqueName, src, file.Size, contentType); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при загрузке файла в S3"})
				return
			}
			filename = uniqueName
		} else {
			// Локальное сохранение (fallback)
			filePath := filepath.Join("uploads", "files", filename)
			if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при создании директории"})
				return
			}
			if err := c.SaveUploadedFile(file, filePath); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при сохранении файла"})
				return
			}
		}

		certificate := db.File{Filename: filename}
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

	// Сначала проверяем локальный файл
	filePath := filepath.Join("uploads", "files", filename)
	if _, err := os.Stat(filePath); err == nil {
		c.Header("Content-Type", "image/*")
		c.Header("Cache-Control", "public, max-age=31536000")
		c.File(filePath)
		return
	}

	// Если локально нет - пробуем S3
	if storage.IsS3Enabled() {
		obj, info, err := storage.GetObject(context.Background(), filesPrefix, filename)
		if err == nil && obj != nil {
			defer obj.Close()
			if info.ContentType != "" {
				c.Header("Content-Type", info.ContentType)
			} else {
				c.Header("Content-Type", "image/*")
			}
			c.Header("Cache-Control", "public, max-age=31536000")
			c.Status(http.StatusOK)
			io.Copy(c.Writer, obj)
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
}

func DownloadFiles(c *gin.Context) {
	filename, err := url.QueryUnescape(c.Param("filename"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректное имя файла"})
		return
	}

	// Сначала проверяем локальный файл
	filePath := filepath.Join("uploads", "files", filename)
	if _, err := os.Stat(filePath); err == nil {
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", url.PathEscape(filename)))
		c.Header("Content-Type", "application/octet-stream")
		c.File(filePath)
		return
	}

	// Если локально нет - пробуем S3
	if storage.IsS3Enabled() {
		obj, _, err := storage.GetObject(context.Background(), filesPrefix, filename)
		if err == nil && obj != nil {
			defer obj.Close()
			c.Header("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", url.PathEscape(filename)))
			c.Header("Content-Type", "application/octet-stream")
			c.Status(http.StatusOK)
			io.Copy(c.Writer, obj)
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
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

	ext := filepath.Ext(request.OldName)
	newNameWithExt := request.NewName + ext

	ctx := context.Background()

	// Проверяем где находится файл и переименовываем
	oldPath := filepath.Join("uploads", "files", request.OldName)
	if _, err := os.Stat(oldPath); err == nil {
		// Локальный файл
		newPath := filepath.Join("uploads", "files", newNameWithExt)
		if err := os.Rename(oldPath, newPath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при переименовании файла"})
			return
		}
	} else if storage.IsS3Enabled() {
		// S3 файл - копируем с новым именем и удаляем старый
		if !storage.ObjectExists(ctx, filesPrefix, request.OldName) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
			return
		}
		if err := storage.CopyObject(ctx, filesPrefix, request.OldName, filesPrefix, newNameWithExt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при переименовании файла в S3"})
			return
		}
		if err := storage.DeleteObject(ctx, filesPrefix, request.OldName); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при удалении старого файла из S3"})
			return
		}
	} else {
		c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
		return
	}

	if err := db.DB.Model(&db.File{}).Where("filename = ?", request.OldName).Update("filename", newNameWithExt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при обновлении имени файла в БД"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Файл успешно переименован"})
}

func DeleteFiles(c *gin.Context) {
	filename := c.Param("filename")

	ctx := context.Background()

	// Пробуем удалить локальный файл
	filePath := filepath.Join("uploads", "files", filename)
	localDeleted := false
	if _, err := os.Stat(filePath); err == nil {
		if err := os.Remove(filePath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при удалении файла"})
			return
		}
		localDeleted = true
	}

	// Также пробуем удалить из S3
	if storage.IsS3Enabled() {
		_ = storage.DeleteObject(ctx, filesPrefix, filename)
	}

	if !localDeleted && !storage.IsS3Enabled() {
		c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
		return
	}

	if err := db.DB.Where("filename = ?", filename).Delete(&db.File{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при удалении данных из БД"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Файл успешно удален"})
}

func SearchFiles(c *gin.Context) {
	query := c.DefaultQuery("query", "")

	var files []db.File
	if err := db.DB.Where("filename LIKE ?", "%"+query+"%").Find(&files).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при поиске сертификатов"})
		return
	}

	var filenames []string
	for _, cert := range files {
		filenames = append(filenames, cert.Filename)
	}

	c.JSON(http.StatusOK, filenames)
}
