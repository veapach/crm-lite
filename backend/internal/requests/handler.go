package requests

import (
	"backend/internal/db"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// TODO: Изменение, удаление заявок + фронтенд

func GetRequests(c *gin.Context) {
	_, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	var requests []db.Request
	if err := db.DB.Preload("Engineer").Preload("Report").Find(&requests).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении заявок"})
		return
	}

	if len(requests) == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "Список заявок пуст"})
	}

	c.JSON(http.StatusOK, requests)

}

func GetRequestById(c *gin.Context) {

	_, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	id := c.Param("id")

	var request db.Request
	if err := db.DB.Preload("Engineer").Preload("Report").First(&request, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Заявка не найдена"})
		return
	}

	c.JSON(http.StatusOK, request)

}

func CreateRequest(c *gin.Context) {

	var newRequest db.Request
	if err := c.ShouldBindJSON(&newRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Неверный формат запроса: %v", err)})
		return
	}

	if err := db.DB.Create(&newRequest).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при создании заявки"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Заяввка создана"})

}

func UpdateRequest(c *gin.Context) {
	_, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	id := c.Param("id")

	var request db.Request
	if err := db.DB.First(&request, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Заявка не найдена"})
		return
	}

	var updatedData db.Request
	if err := c.ShouldBindJSON(&updatedData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат запроса"})
		return
	}

	if err := db.DB.Model(&request).Updates(updatedData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при обновлении заявки"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Заявка обновлена"})

}

func DeleteReport(c *gin.Context) {
	_, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	id := c.Param("id")

	if err := db.DB.Delete(&db.Request{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при удалении заявки"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Заявка удалена"})
}
