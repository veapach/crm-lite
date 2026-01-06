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

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/streadway/amqp"
)

// RabbitMQ connection (инициализируй в main)
var TicketQueue *amqp.Channel

var lastNotifiedUnassignedCount int64 = -1

const ticketsPrefix = "tickets/"

var jwtkey string
var secretKey []byte

func init() {
	if err := godotenv.Load(); err != nil {
		// Ignore error in init
	}
	jwtkey, _ = os.LookupEnv("JWTKEY")
	secretKey = []byte(jwtkey)
}

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

	// Проверяем, есть ли авторизованный клиент через токен
	var clientID *uint
	if tokenString, exists := c.Get("clientToken"); exists {
		if ts, ok := tokenString.(string); ok && ts != "" {
			token, err := jwt.Parse(ts, func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method")
				}
				return secretKey, nil
			})
			if err == nil && token.Valid {
				if claims, ok := token.Claims.(jwt.MapClaims); ok {
					if tokenType, _ := claims["type"].(string); tokenType == "client" {
						if cID, ok := claims["client_id"].(float64); ok {
							id := uint(cID)
							clientID = &id
						}
					}
				}
			}
		}
	}

	if strings.HasPrefix(c.GetHeader("Content-Type"), "multipart/form-data") {
		ticket.FullName = c.PostForm("fullName")
		ticket.Position = c.PostForm("position")
		ticket.Contact = c.PostForm("contact")
		ticket.Address = c.PostForm("address")
		ticket.Description = c.PostForm("description")
		ticket.Date = time.Now().Format("2006-01-02")
		ticket.Status = "Не назначено"
		ticket.ClientID = clientID

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
		ticket.ClientID = clientID
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

		// Устанавливаем дату завершения если заявка завершена
		if input.Status == "Завершено" {
			ticket.CompletedAt = time.Now().Format("2006-01-02 15:04:05")
		}
	}

	if err := db.DB.Save(&ticket).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка обновления"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "ticket": ticket})

	go notifyUnassignedIfNeeded()
}

// LinkReportToTicket - связывание отчёта с заявкой
func LinkReportToTicket(c *gin.Context) {
	var input struct {
		TicketID uint `json:"ticketId" binding:"required"`
		ReportID uint `json:"reportId" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат данных"})
		return
	}

	// Проверяем существование заявки
	var ticket db.ClientTicket
	if err := db.DB.First(&ticket, input.TicketID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заявка не найдена"})
		return
	}

	// Проверяем существование отчёта
	var report db.Report
	if err := db.DB.First(&report, input.ReportID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Отчёт не найден"})
		return
	}

	// Проверяем, нет ли уже такой связи
	var existing db.TicketReport
	if err := db.DB.Where("ticket_id = ? AND report_id = ?", input.TicketID, input.ReportID).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Отчёт уже привязан к этой заявке"})
		return
	}

	// Создаём связь
	ticketReport := db.TicketReport{
		TicketID:  input.TicketID,
		ReportID:  input.ReportID,
		CreatedAt: time.Now().Format("2006-01-02 15:04:05"),
	}

	if err := db.DB.Create(&ticketReport).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка создания связи"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Отчёт успешно привязан к заявке"})
}

// UnlinkReportFromTicket - отвязывание отчёта от заявки
func UnlinkReportFromTicket(c *gin.Context) {
	ticketID := c.Param("ticketId")
	reportID := c.Param("reportId")

	if err := db.DB.Where("ticket_id = ? AND report_id = ?", ticketID, reportID).Delete(&db.TicketReport{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка удаления связи"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Связь удалена"})
}

// GetTicketReports - получение отчётов привязанных к заявке
func GetTicketReports(c *gin.Context) {
	ticketID := c.Param("id")

	var ticketReports []db.TicketReport
	if err := db.DB.Where("ticket_id = ?", ticketID).Find(&ticketReports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения отчётов"})
		return
	}

	type ReportInfo struct {
		ID             uint   `json:"id"`
		Filename       string `json:"filename"`
		Date           string `json:"date"`
		Address        string `json:"address"`
		Classification string `json:"classification"`
		UserID         uint   `json:"userId"`
	}

	var reports []ReportInfo
	for _, tr := range ticketReports {
		var report db.Report
		if err := db.DB.First(&report, tr.ReportID).Error; err == nil {
			reports = append(reports, ReportInfo{
				ID:             report.ID,
				Filename:       report.Filename,
				Date:           report.Date,
				Address:        report.Address,
				Classification: report.Classification,
				UserID:         report.UserID,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{"reports": reports})
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
