package tickets

import (
	"backend/internal/db"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/streadway/amqp"
)

// RabbitMQ connection (инициализируй в main)
var TicketQueue *amqp.Channel

func CreateTicket(c *gin.Context) {
	var ticket db.ClientTicket

	if strings.HasPrefix(c.GetHeader("Content-Type"), "multipart/form-data") {
		ticket.FullName = c.PostForm("fullName")
		ticket.Position = c.PostForm("position")
		ticket.Contact = c.PostForm("contact")
		ticket.Address = c.PostForm("address")
		ticket.Description = c.PostForm("description")
		ticket.Date = time.Now().Format("2006-01-02")
		ticket.Status = "Не назначено"

		form, err := c.MultipartForm()
		if err == nil && form != nil {
			files := form.File["files"]
			var savedFiles []string
			for _, file := range files {
				saveDir := "uploads/tickets"
				os.MkdirAll(saveDir, os.ModePerm)
				filename := time.Now().Format("20060102150405") + "_" + file.Filename
				savePath := filepath.Join(saveDir, filename)
				if err := c.SaveUploadedFile(file, savePath); err == nil {
					savedFiles = append(savedFiles, filename)
				}
			}
			ticket.Files = strings.Join(savedFiles, ",")
		}
	} else {
		if err := c.ShouldBindJSON(&ticket); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат данных: " + err.Error()})
			return
		}
		ticket.Date = time.Now().Format("2006-01-02")
		ticket.Status = "Не назначено"
	}

	body, err := json.Marshal(ticket)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сериализации"})
		return
	}
	err = TicketQueue.Publish(
		"", "tickets", false, false,
		amqp.Publishing{ContentType: "application/json", Body: body},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка отправки в очередь"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func GetClientTickets(c *gin.Context) {
	var tickets []db.ClientTicket
	var total int64

	// Фильтры
	status := c.Query("status")
	date := c.Query("date")
	search := c.Query("search")
	sort := c.DefaultQuery("sort", "desc")
	page := c.DefaultQuery("page", "1")
	limit := c.DefaultQuery("limit", "20")

	dbQuery := db.DB.Model(&db.ClientTicket{})

	if status != "" {
		dbQuery = dbQuery.Where("status = ?", status)
	}
	if date != "" {
		dbQuery = dbQuery.Where("date = ?", date)
	}
	if search != "" {
		like := "%" + search + "%"
		dbQuery = dbQuery.Where("full_name ILIKE ? OR position ILIKE ? OR contact ILIKE ? OR address ILIKE ? OR description ILIKE ?", like, like, like, like, like)
	}

	// Сортировка
	if sort == "asc" {
		dbQuery = dbQuery.Order("date asc")
	} else {
		dbQuery = dbQuery.Order("date desc")
	}

	// Пагинация
	var pageInt, limitInt int
	fmt.Sscanf(page, "%d", &pageInt)
	fmt.Sscanf(limit, "%d", &limitInt)
	if pageInt < 1 {
		pageInt = 1
	}
	offset := (pageInt - 1) * limitInt

	dbQuery.Count(&total)
	dbQuery.Offset(offset).Limit(limitInt).Find(&tickets)

	c.JSON(http.StatusOK, gin.H{
		"tickets": tickets,
		"total":   total,
		"page":    pageInt,
		"limit":   limitInt,
	})
}

func UpdateClientTicket(c *gin.Context) {
	id := c.Param("id")
	var input struct {
		EngineerID   *uint   `json:"engineerId"`
		EngineerName *string `json:"engineerName"`
		Status       string  `json:"status"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат данных"})
		return
	}

	var ticket db.ClientTicket
	if err := db.DB.First(&ticket, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заявка не найдена"})
		return
	}

	// Обновление
	if input.EngineerID != nil {
		ticket.EngineerID = input.EngineerID
	} else if input.Status == "Не назначено" {
		ticket.EngineerID = nil
		ticket.EngineerName = ""
	}

	if input.EngineerName != nil {
		ticket.EngineerName = *input.EngineerName
	} else if input.Status == "Не назначено" {
		ticket.EngineerID = nil
		ticket.EngineerName = ""
	}

	if input.Status != "" {
		// Если статус "Выполнено" — удалить фото
		if input.Status == "Выполнено" && ticket.Files != "" {
			files := strings.Split(ticket.Files, ",")
			for _, f := range files {
				path := filepath.Join("uploads/tickets", f)
				_ = os.Remove(path)
			}
			ticket.Files = ""
		}
		ticket.Status = input.Status
	}

	if err := db.DB.Save(&ticket).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка обновления"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "ticket": ticket})
}

func DeleteClientTicket(c *gin.Context) {
	id := c.Param("id")
	var ticket db.ClientTicket
	if err := db.DB.First(&ticket, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заявка не найдена"})
		return
	}
	// Удалить файлы
	if ticket.Files != "" {
		files := strings.Split(ticket.Files, ",")
		for _, f := range files {
			path := filepath.Join("uploads/tickets", f)
			_ = os.Remove(path)
		}
	}
	if err := db.DB.Delete(&ticket).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка удаления"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func ServeTicketFile(c *gin.Context) {
	filename := c.Param("filename")
	filePath := filepath.Join("uploads/tickets", filename)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
		return
	}

	c.File(filePath)
}
