package users

import (
	"backend/internal/db"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

var secretKey = []byte("testjwtkey")

func Register(c *gin.Context) {
	var input db.User
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
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
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	})
	return token.SignedString(secretKey)
}

func Login(c *gin.Context) {
	var input struct {
		Phone    string `json:"phone"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid format"})
		return
	}

	var user db.User
	if err := db.DB.Where("phone = ?", input.Phone).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Incorrect password"})
		return
	}

	token, err := generateToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error while generating token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token})

}

func CheckAuth(c *gin.Context) {
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

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "недействительный токен: " + err.Error()})
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "недействительные утверждения токена"})
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

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.GetHeader("Authorization")
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "токен отсутствует"})
			c.Abort()
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
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "недействительные утверждения токена"})
			c.Abort()
			return
		}

		userID := uint(claims["user_id"].(float64))
		c.Set("userID", userID)
		c.Next()
	}
}
