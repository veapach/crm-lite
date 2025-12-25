package tickets

import (
	"backend/internal/db"
	"backend/internal/storage"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/streadway/amqp"
)

// RabbitMQ connection (инициализируй в main)
var TicketQueue *amqp.Channel

var lastNotifiedUnassignedCount int64 = -1

const ticketsPrefix = "tickets/"

func russianPlural(n int64, one string, few string, many string) string {
	mod10 := n % 10
	mod100 := n % 100
	if mod10 == 1 && mod100 != 11 {
		return one
	}
	if mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) {
		return few
	}
	return many
}

func notifyUnassignedIfNeeded() {
	var total int64
	db.DB.Model(&db.ClientTicket{}).Where("status = ?", "Не назначено").Count(&total)
	if total <= 0 {
		lastNotifiedUnassignedCount = 0
		return
	}
	if total == lastNotifiedUnassignedCount {
		return
	}
	token := os.Getenv("BOT_TOKEN")
	if token == "" {
		lastNotifiedUnassignedCount = total
		return
	}
	var users []db.User
	db.DB.Where("department != ? AND telegram_notify_on = ? AND telegram_chat_id IS NOT NULL", "Клиент", true).Find(&users)
	var chatIDs []int64
	for _, u := range users {
		if u.TelegramChatID != nil {
			chatIDs = append(chatIDs, *u.TelegramChatID)
		}
	}
	if len(chatIDs) == 0 {
		lastNotifiedUnassignedCount = total
		return
	}
	var list []db.ClientTicket
	db.DB.Where("status = ?", "Не назначено").Find(&list)
	sort.Slice(list, func(i, j int) bool { return list[i].ID > list[j].ID })
	if len(list) > 3 {
		list = list[:3]
	}
	word := russianPlural(total, "заявка", "заявки", "заявок")
	header := fmt.Sprintf("🚨 <b>Внимание:</b> %d %s без назначения", total, word)
	var details []string
	for _, t := range list {
		desc := t.Description
		if len(desc) > 80 {
			desc = desc[:80] + "…"
		}
		line := fmt.Sprintf("• <b>%s</b> — %s — %s", t.Date, htmlEscape(t.Address), htmlEscape(desc))
		details = append(details, line)
	}
	var body string
	if len(details) > 0 {
		body = header + "\n" + strings.Join(details, "\n") + "\n\n" + "<a href=\"https://crmlite-vv.ru/inner-tickets\">проверить заявки</a>"
	} else {
		body = header + "\n\n" + "<a href=\"https://crmlite-vv.ru/inner-tickets\">проверить заявки</a>"
	}
	for _, chatID := range chatIDs {
		u := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
		data := url.Values{}
		data.Set("chat_id", fmt.Sprintf("%d", chatID))
		data.Set("text", body)
		data.Set("parse_mode", "HTML")
		http.Post(u, "application/x-www-form-urlencoded", strings.NewReader(data.Encode()))
	}
	lastNotifiedUnassignedCount = total
}

func htmlEscape(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	return s
}

// NotifyUnassignedPublic — экспортируемая обертка для периодического/ручного вызова
func NotifyUnassignedPublic() {
	notifyUnassignedIfNeeded()
}

// DebugSendUnassigned — ручной запуск уведомления (для админ-маршрута)
func DebugSendUnassigned(c *gin.Context) {
	go notifyUnassignedIfNeeded()
	c.JSON(http.StatusOK, gin.H{"success": true})
}

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
			ctx := context.Background()

			for _, file := range files {
				filename := time.Now().Format("20060102150405") + "_" + file.Filename

				if storage.IsS3Enabled() {
					// Загрузка в S3
					src, err := file.Open()
					if err != nil {
						continue
					}
					contentType := file.Header.Get("Content-Type")
					if contentType == "" {
						contentType = "application/octet-stream"
					}
					uniqueName := storage.GetUniqueFileName(ctx, ticketsPrefix, filename)
					if err := storage.UploadObject(ctx, ticketsPrefix, uniqueName, src, file.Size, contentType); err != nil {
						src.Close()
						continue
					}
					src.Close()
					savedFiles = append(savedFiles, uniqueName)
				} else {
					// Локальное сохранение (fallback)
					saveDir := "uploads/tickets"
					os.MkdirAll(saveDir, os.ModePerm)
					savePath := filepath.Join(saveDir, filename)
					if err := c.SaveUploadedFile(file, savePath); err == nil {
						savedFiles = append(savedFiles, filename)
					}
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

	go notifyUnassignedIfNeeded()
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
			ctx := context.Background()
			for _, f := range files {
				// Удаляем из S3 если включено
				if storage.IsS3Enabled() {
					_ = storage.DeleteObject(ctx, ticketsPrefix, f)
				}
				// Также пробуем удалить локально
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

	go notifyUnassignedIfNeeded()
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
		ctx := context.Background()
		for _, f := range files {
			// Удаляем из S3 если включено
			if storage.IsS3Enabled() {
				_ = storage.DeleteObject(ctx, ticketsPrefix, f)
			}
			// Также пробуем удалить локально
			path := filepath.Join("uploads/tickets", f)
			_ = os.Remove(path)
		}
	}
	if err := db.DB.Delete(&ticket).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка удаления"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})

	go notifyUnassignedIfNeeded()
}

func ServeTicketFile(c *gin.Context) {
	filename := c.Param("filename")

	// Сначала проверяем локальный файл
	filePath := filepath.Join("uploads/tickets", filename)
	if _, err := os.Stat(filePath); err == nil {
		c.File(filePath)
		return
	}

	// Если локально нет - пробуем S3
	if storage.IsS3Enabled() {
		obj, info, err := storage.GetObject(context.Background(), ticketsPrefix, filename)
		if err == nil && obj != nil {
			defer obj.Close()
			if info.ContentType != "" {
				c.Header("Content-Type", info.ContentType)
			} else {
				c.Header("Content-Type", "application/octet-stream")
			}
			c.Status(http.StatusOK)
			io.Copy(c.Writer, obj)
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
}
