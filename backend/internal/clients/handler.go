package clients

import (
	"backend/internal/db"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

var jwtkey string
var secretKey []byte

func init() {
	if err := godotenv.Load(); err != nil {
		panic("No .env file found")
	}
	var exists bool
	jwtkey, exists = os.LookupEnv("JWTKEY")
	if !exists {
		panic("JWTKEY not found in .env file")
	}
	secretKey = []byte(jwtkey)
}

func generateClientToken(clientID uint) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"client_id": clientID,
		"type":      "client",
		"exp":       time.Now().Add(time.Hour * 730).Unix(),
	})
	return token.SignedString(secretKey)
}

// normalizePhone нормализует номер телефона для поиска
func normalizePhone(phone string) string {
	// Убираем все кроме цифр
	digits := ""
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			digits += string(r)
		}
	}
	// Если начинается с 8, заменяем на 7
	if len(digits) == 11 && digits[0] == '8' {
		digits = "7" + digits[1:]
	}
	return digits
}

// ClientRegister - регистрация нового клиента
func ClientRegister(c *gin.Context) {
	var input struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
		FullName string `json:"fullName" binding:"required"`
		Phone    string `json:"phone"`
		Position string `json:"position"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат данных"})
		return
	}

	// Проверка email
	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	if !strings.Contains(input.Email, "@") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат email"})
		return
	}

	// Проверка уникальности email
	var existing db.Client
	if err := db.DB.Where("email = ?", input.Email).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Пользователь с таким email уже зарегистрирован"})
		return
	}

	// Хеширование пароля
	hashedPass, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при регистрации"})
		return
	}

	client := db.Client{
		Email:     input.Email,
		Password:  string(hashedPass),
		FullName:  strings.TrimSpace(input.FullName),
		Phone:     strings.TrimSpace(input.Phone),
		Position:  strings.TrimSpace(input.Position),
		CreatedAt: time.Now().Format("2006-01-02 15:04:05"),
	}

	if err := db.DB.Create(&client).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при регистрации"})
		return
	}

	token, err := generateClientToken(client.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка генерации токена"})
		return
	}

	// Установка cookie
	setClientCookies(c, token)

	c.JSON(http.StatusOK, gin.H{
		"message": "Регистрация успешна",
		"token":   token,
		"client": gin.H{
			"id":       client.ID,
			"email":    client.Email,
			"fullName": client.FullName,
			"phone":    client.Phone,
			"position": client.Position,
		},
	})
}

// ClientLogin - вход клиента
func ClientLogin(c *gin.Context) {
	var input struct {
		Login    string `json:"login" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат данных"})
		return
	}

	login := strings.TrimSpace(strings.ToLower(input.Login))

	// Поиск по email или телефону
	var client db.Client
	if strings.Contains(login, "@") {
		// Поиск по email
		if err := db.DB.Where("email = ?", login).First(&client).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Пользователь не найден"})
			return
		}
	} else {
		// Поиск по телефону - нормализуем номер
		phone := normalizePhone(login)
		if err := db.DB.Where("phone = ? OR phone = ? OR phone = ?", phone, login, "+"+login).First(&client).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Пользователь не найден"})
			return
		}
	}

	if err := bcrypt.CompareHashAndPassword([]byte(client.Password), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный пароль"})
		return
	}

	// Обновляем время последнего входа
	db.DB.Model(&client).Update("last_login_at", time.Now().Format("2006-01-02 15:04:05"))

	token, err := generateClientToken(client.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка генерации токена"})
		return
	}

	setClientCookies(c, token)

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"client": gin.H{
			"id":       client.ID,
			"email":    client.Email,
			"fullName": client.FullName,
			"phone":    client.Phone,
			"position": client.Position,
		},
	})
}

// ClientLogout - выход клиента
func ClientLogout(c *gin.Context) {
	clearClientCookies(c)
	c.JSON(http.StatusOK, gin.H{"message": "Успешный выход"})
}

// ClientCheckAuth - проверка авторизации клиента
func ClientCheckAuth(c *gin.Context) {
	tokenString := getClientToken(c)
	if tokenString == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "токен отсутствует"})
		return
	}

	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("неожиданный метод подписи: %v", t.Header["alg"])
		}
		return secretKey, nil
	})

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "недействительный токен"})
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "недействительные утверждения токена"})
		return
	}

	// Проверяем что это клиентский токен
	tokenType, _ := claims["type"].(string)
	if tokenType != "client" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "недействительный тип токена"})
		return
	}

	exp := claims["exp"].(float64)
	if int64(exp) < time.Now().Unix() {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "срок действия токена истек"})
		return
	}

	clientID := uint(claims["client_id"].(float64))
	var client db.Client
	if err := db.DB.First(&client, clientID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не найден"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"client": gin.H{
			"id":       client.ID,
			"email":    client.Email,
			"fullName": client.FullName,
			"phone":    client.Phone,
			"position": client.Position,
		},
	})
}

// ClientUpdateProfile - обновление профиля клиента
func ClientUpdateProfile(c *gin.Context) {
	clientID, exists := c.Get("clientID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "не авторизован"})
		return
	}

	var input struct {
		FullName string `json:"fullName"`
		Phone    string `json:"phone"`
		Position string `json:"position"`
		Password string `json:"password,omitempty"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный формат данных"})
		return
	}

	updates := map[string]interface{}{
		"full_name": strings.TrimSpace(input.FullName),
		"phone":     strings.TrimSpace(input.Phone),
		"position":  strings.TrimSpace(input.Position),
	}

	if input.Password != "" {
		hashedPass, _ := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		updates["password"] = string(hashedPass)
	}

	if err := db.DB.Model(&db.Client{}).Where("id = ?", clientID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка при обновлении профиля"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "профиль успешно обновлен"})
}

// GetClientTickets - получение заявок клиента
func GetClientTickets(c *gin.Context) {
	clientID, exists := c.Get("clientID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "не авторизован"})
		return
	}

	var tickets []db.ClientTicket
	query := db.DB.Where("client_id = ?", clientID).Order("date desc, id desc")

	// Фильтр по статусу
	status := c.Query("status")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Find(&tickets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка получения заявок"})
		return
	}

	type ReportInfo struct {
		ID             uint   `json:"id"`
		Filename       string `json:"filename"`
		Date           string `json:"date"`
		Classification string `json:"classification"`
	}

	// Для каждой заявки получаем привязанные отчёты
	type TicketWithReports struct {
		db.ClientTicket
		Reports []ReportInfo `json:"reports"`
	}

	var result []TicketWithReports
	for _, ticket := range tickets {
		ticketWithReports := TicketWithReports{
			ClientTicket: ticket,
			Reports:      []ReportInfo{},
		}

		// Получаем связанные отчёты
		var ticketReports []db.TicketReport
		if err := db.DB.Where("ticket_id = ?", ticket.ID).Find(&ticketReports).Error; err == nil {
			for _, tr := range ticketReports {
				var report db.Report
				if err := db.DB.First(&report, tr.ReportID).Error; err == nil {
					ticketWithReports.Reports = append(ticketWithReports.Reports, ReportInfo{
						ID:             report.ID,
						Filename:       report.Filename,
						Date:           report.Date,
						Classification: report.Classification,
					})
				}
			}
		}

		result = append(result, ticketWithReports)
	}

	c.JSON(http.StatusOK, gin.H{
		"tickets": result,
		"total":   len(result),
	})
}

// GetClientTicketByID - получение конкретной заявки клиента
func GetClientTicketByID(c *gin.Context) {
	clientID, exists := c.Get("clientID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "не авторизован"})
		return
	}

	ticketID := c.Param("id")
	var ticket db.ClientTicket
	if err := db.DB.Where("id = ? AND client_id = ?", ticketID, clientID).First(&ticket).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заявка не найдена"})
		return
	}

	// Получаем связанные отчёты
	type ReportInfo struct {
		ID             uint   `json:"id"`
		Filename       string `json:"filename"`
		Date           string `json:"date"`
		Classification string `json:"classification"`
	}
	var reports []ReportInfo

	var ticketReports []db.TicketReport
	if err := db.DB.Where("ticket_id = ?", ticket.ID).Find(&ticketReports).Error; err == nil {
		for _, tr := range ticketReports {
			var report db.Report
			if err := db.DB.First(&report, tr.ReportID).Error; err == nil {
				reports = append(reports, ReportInfo{
					ID:             report.ID,
					Filename:       report.Filename,
					Date:           report.Date,
					Classification: report.Classification,
				})
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"ticket":  ticket,
		"reports": reports,
	})
}

// ClientAuthMiddleware - middleware для проверки авторизации клиента
func ClientAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := getClientToken(c)
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "токен отсутствует"})
			c.Abort()
			return
		}

		token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("неожиданный метод подписи: %v", t.Header["alg"])
			}
			return secretKey, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "недействительный токен"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "недействительные утверждения токена"})
			c.Abort()
			return
		}

		// Проверяем что это клиентский токен
		tokenType, _ := claims["type"].(string)
		if tokenType != "client" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "недействительный тип токена"})
			c.Abort()
			return
		}

		exp := claims["exp"].(float64)
		if int64(exp) < time.Now().Unix() {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "срок действия токена истек"})
			c.Abort()
			return
		}

		clientID := uint(claims["client_id"].(float64))
		c.Set("clientID", clientID)
		c.Next()
	}
}

// Helper functions
func getClientToken(c *gin.Context) string {
	tokenString, err := c.Cookie("client_token")
	if err != nil {
		tokenString = c.GetHeader("Authorization")
		if tokenString != "" && strings.HasPrefix(tokenString, "Bearer") {
			tokenString = strings.TrimPrefix(strings.TrimPrefix(tokenString, "Bearer"), " ")
		}
	}
	return tokenString
}

func setClientCookies(c *gin.Context, token string) {
	maxAge := int((time.Hour * 730).Seconds())

	c.SetCookie("client_token", token, maxAge, "/", "crmlite-vv.ru", false, true)
	c.SetCookie("client_token", token, maxAge, "/", "localhost", false, true)
	c.SetCookie("client_token", token, maxAge, "/", "", false, true)
}

func clearClientCookies(c *gin.Context) {
	c.SetCookie("client_token", "", -1, "/", "crmlite-vv.ru", false, true)
	c.SetCookie("client_token", "", -1, "/", "localhost", false, true)
	c.SetCookie("client_token", "", -1, "/", "", false, true)
}
