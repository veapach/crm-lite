package users

import (
	"crm-backend/internal/db"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
)

var jwtKey = []byte("testjwttoken")

var allowedPhones = map[string]bool{
	"79197627770": true,
	"+0987654321": true,
}

type Claims struct {
	Phone string `json:"phone"`
	jwt.StandardClaims
}

func RegisterHandler(c *gin.Context) {
	var user db.User
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат запроса"})
		return
	}

	if !allowedPhones[user.Phone] {
		c.JSON(http.StatusForbidden, gin.H{"error": "Телефон не разрешен для регистрации"})
		return
	}

	db.DB.Create(&user)
	c.JSON(http.StatusOK, gin.H{"message": "Пользователь зарегистрирован"})
}

func LoginHandler(c *gin.Context) {
	var user db.User
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат запроса"})
		return
	}

	var dbUser db.User
	if err := db.DB.Where("phone = ? AND password = ?", user.Phone, user.Password).First(&dbUser).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный телефон или пароль"})
		return
	}

	// Генерируем JWT токен
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		Phone: dbUser.Phone,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка генерации токена"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":   tokenString,
		"expires": expirationTime,
		"user":    dbUser,
	})
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.GetHeader("Authorization")
		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Токен отсутствует"})
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Неверный токен"})
			return
		}

		var user db.User
		if err := db.DB.Where("phone = ?", claims.Phone).First(&user).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Пользователь не найден"})
			return
		}

		c.Set("user", user)
		c.Next()
	}
}

func CheckAuthHandler(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"isAuthenticated": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"isAuthenticated": true,
		"user":            user,
	})
}
