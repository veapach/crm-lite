package users

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
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

func init() {
	if err := godotenv.Load(); err != nil {
		panic("No .env file found")
	}
	var exists bool
	jwtkey, exists = os.LookupEnv("JWTKEY")
	if !exists {
		panic("JWTKEY not found in .env file")
	}
}

var jwtkey string
var secretKey = []byte(jwtkey)

func checkIfPhoneAllowed(inputPhone string) bool {
	var allowedPhone db.AllowedPhone
	if err := db.DB.Where("phone = ?", inputPhone).First(&allowedPhone).Error; err != nil {
		return false
	}
	return true
}

func Register(c *gin.Context) {
	var input db.User
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if isAllowed := checkIfPhoneAllowed(input.Phone); !isAllowed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "У вас нет доступа к сайту"})
		return
	}

	var existing db.User
	if err := db.DB.Where("phone = ?", input.Phone).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User already exists"})
		return
	}

	hashedPass, _ := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	input.Password = string(hashedPass)

	if err := db.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error while registrating"})
		return
	}

	token, err := generateToken(input.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error generating token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Registration completed",
		"token":   token,
	})
}

func generateToken(userID uint) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 730).Unix(),
	})
	return token.SignedString(secretKey)
}

func Login(c *gin.Context) {
	var input struct {
		Phone    string `json:"phone"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат данных"})
		return
	}

	var user db.User
	if err := db.DB.Where("phone = ?", input.Phone).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Пользователь не найден"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный пароль"})
		return
	}

	token, err := generateToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при генерации токена"})
		return
	}

	c.SetCookie(
		"token",
		token,
		int((time.Hour * 730).Seconds()),
		"/",
		"crmlite-vv.ru",
		false,
		true,
	)

	c.SetCookie(
		"token",
		token,
		int((time.Hour * 730).Seconds()),
		"/",
		"localhost",
		false,
		true,
	)

	c.SetCookie(
		"token",
		token,
		int((time.Hour * 730).Seconds()),
		"/",
		"",
		false,
		true,
	)

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":         user.ID,
			"firstName":  user.FirstName,
			"lastName":   user.LastName,
			"department": user.Department,
			"phone":      user.Phone,
		},
	})
}

func Logout(c *gin.Context) {
	c.SetCookie(
		"token",
		"",
		-1,
		"/",
		"crmlite-vv.ru",
		false,
		true,
	)

	c.SetCookie(
		"token",
		"",
		-1,
		"/",
		"localhost",
		false,
		true,
	)

	c.SetCookie(
		"token",
		"",
		-1,
		"/",
		"",
		false,
		true,
	)

	c.JSON(http.StatusOK, gin.H{"message": "Успешный выход"})
}

func CheckAuth(c *gin.Context) {
	tokenString, err := c.Cookie("token")
	if err != nil {
		tokenString = c.GetHeader("Authorization")
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "токен отсутствует"})
			return
		}

		if strings.HasPrefix(tokenString, "Bearer") {
			tokenString = strings.TrimPrefix(strings.TrimPrefix(tokenString, "Bearer"), " ")
		}
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

	exp := claims["exp"].(float64)
	if int64(exp) < time.Now().Unix() {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "срок действия токена истек"})
		return
	}

	userID := uint(claims["user_id"].(float64))
	var user db.User
	if err := db.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не найден"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":         user.ID,
			"firstName":  user.FirstName,
			"lastName":   user.LastName,
			"department": user.Department,
			"phone":      user.Phone,
		},
	})
}

func GetUsers(c *gin.Context) {
	var users []db.User
	if err := db.DB.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении пользователей"})
		return
	}

	c.JSON(http.StatusOK, users)
}

func UpdateProfile(c *gin.Context) {
	tokenString := c.GetHeader("Authorization")
	if tokenString == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "токен отсутствует"})
		return
	}

	if strings.HasPrefix(tokenString, "Bearer") {
		tokenString = strings.TrimPrefix(strings.TrimPrefix(tokenString, "Bearer"), " ")
	}

	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("неожиданный метод подписи: %v", t.Header["alg"])
		}
		return secretKey, nil
	})

	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "недействительный токен"})
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "недействительные утверждения токена"})
		return
	}

	userID := uint(claims["user_id"].(float64))

	var input struct {
		FirstName  string `json:"firstName"`
		LastName   string `json:"lastName"`
		Department string `json:"department"`
		Password   string `json:"password,omitempty"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный формат данных"})
		return
	}

	updates := map[string]interface{}{
		"first_name": input.FirstName,
		"last_name":  input.LastName,
		"department": input.Department,
	}

	if input.Password != "" {
		hashedPass, _ := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		updates["password"] = string(hashedPass)
	}

	if err := db.DB.Model(&db.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка при обновлении профиля"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "профиль успешно обновлен"})
}

func GetAllowedPhones(c *gin.Context) {
	var allowedPhones []db.AllowedPhone
	if err := db.DB.Find(&allowedPhones).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении разрешенных телефонов"})
		return
	}

	phoneNumbers := make([]string, len(allowedPhones))
	for i, phone := range allowedPhones {
		phoneNumbers[i] = phone.Phone
	}

	c.JSON(http.StatusOK, phoneNumbers)
}

func AddAllowedPhone(c *gin.Context) {
	var input struct {
		Phone string `json:"phone" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный формат данных"})
		return
	}

	var existingPhone db.AllowedPhone
	if err := db.DB.Where("phone = ?", input.Phone).First(&existingPhone).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "телефон уже в списке разрешенных"})
		return
	}

	allowedPhone := db.AllowedPhone{
		Phone: input.Phone,
	}

	if err := db.DB.Create(&allowedPhone).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка при добавлении телефона"})
		return
	}

	var allowedPhones []db.AllowedPhone
	db.DB.Find(&allowedPhones)

	phoneNumbers := make([]string, len(allowedPhones))
	for i, phone := range allowedPhones {
		phoneNumbers[i] = phone.Phone
	}

	c.JSON(http.StatusOK, gin.H{"message": "телефон успешно добавлен", "phones": phoneNumbers})
}

func RemoveAllowedPhone(c *gin.Context) {
	phone := c.Param("phone")
	if phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "не указан телефон"})
		return
	}

	var allowedPhone db.AllowedPhone
	if err := db.DB.Where("phone = ?", phone).First(&allowedPhone).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "телефон не найден в списке разрешенных"})
		return
	}

	if err := db.DB.Delete(&allowedPhone).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка при удалении телефона"})
		return
	}

	var allowedPhones []db.AllowedPhone
	db.DB.Find(&allowedPhones)

	phoneNumbers := make([]string, len(allowedPhones))
	for i, phone := range allowedPhones {
		phoneNumbers[i] = phone.Phone
	}

	c.JSON(http.StatusOK, gin.H{"message": "телефон успешно удален", "phones": phoneNumbers})
}

func UpdateUser(c *gin.Context) {
	targetUserID := c.Param("id")
	if targetUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "не указан ID пользователя"})
		return
	}

	var input struct {
		FirstName  string `json:"firstName"`
		LastName   string `json:"lastName"`
		Department string `json:"department"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный формат данных"})
		return
	}

	updates := map[string]interface{}{
		"first_name": input.FirstName,
		"last_name":  input.LastName,
		"department": input.Department,
	}

	if err := db.DB.Model(&db.User{}).Where("id = ?", targetUserID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка при обновлении пользователя"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "пользователь успешно обновлен"})
}

func DeleteUser(c *gin.Context) {
	targetUserID := c.Param("id")
	if targetUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "не указан ID пользователя"})
		return
	}

	userID, exists := c.Get("userID")
	if exists && fmt.Sprintf("%v", userID) == targetUserID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "нельзя удалить самого себя"})
		return
	}

	if err := db.DB.Delete(&db.User{}, targetUserID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка при удалении пользователя"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "пользователь успешно удален"})
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString, err := c.Cookie("token")
		if err != nil {
			tokenString = c.GetHeader("Authorization")
			if tokenString == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "токен отсутствует"})
				c.Abort()
				return
			}

			if strings.HasPrefix(tokenString, "Bearer") {
				tokenString = strings.TrimPrefix(strings.TrimPrefix(tokenString, "Bearer"), " ")
			}
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

		exp := claims["exp"].(float64)
		if int64(exp) < time.Now().Unix() {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "срок действия токена истек"})
			c.Abort()
			return
		}

		userID := uint(claims["user_id"].(float64))
		c.Set("userID", userID)
		c.Next()
	}
}

func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
			c.Abort()
			return
		}

		var user db.User
		if err := db.DB.First(&user, userID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не найден"})
			c.Abort()
			return
		}

		if user.Department != "Админ" {
			c.JSON(http.StatusForbidden, gin.H{"error": "недостаточно прав"})
			c.Abort()
			return
		}

		c.Next()
	}
}
