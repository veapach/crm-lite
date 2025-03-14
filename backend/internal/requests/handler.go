package requests

import (
	"backend/internal/db"
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetRequests(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	var user db.User
	if err := db.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении данных пользователя"})
		return
	}

	var requests []db.Request
	query := db.DB.Preload("Engineer")

	if user.Department != "Админ" {
		query = query.Where("engineer_id = ?", userID)
	}

	if err := query.Find(&requests).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении заявок"})
		return
	}

	c.JSON(http.StatusOK, requests)
}

func GetRequestById(c *gin.Context) {
	id := c.Param("id")
	var request db.Request

	if err := db.DB.Preload("Engineer").First(&request, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заявка не найдена"})
		return
	}

	c.JSON(http.StatusOK, request)
}

func CreateRequest(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	var input struct {
		Date        string `json:"date" binding:"required"`
		Address     string `json:"address" binding:"required"`
		Type        string `json:"type" binding:"required"`
		Description string `json:"description" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат данных"})
		return
	}

	request := db.Request{
		Date:        input.Date,
		Address:     input.Address,
		Status:      "В работе",
		EngineerID:  userID.(uint),
		Type:        input.Type,
		Description: input.Description,
	}

	if err := db.DB.Create(&request).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при создании заявки"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Заявка успешно создана",
		"request": request,
	})
}

func UpdateRequest(c *gin.Context) {
	id := c.Param("id")
	var request db.Request

	if err := db.DB.First(&request, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заявка не найдена"})
		return
	}

	var input struct {
		Status      string `json:"status"`
		ReportID    *uint  `json:"reportId"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат данных"})
		return
	}

	updates := map[string]interface{}{}
	if input.Status != "" {
		updates["status"] = input.Status
	}
	if input.ReportID != nil {
		updates["report_id"] = input.ReportID
	}
	if input.Description != "" {
		updates["description"] = input.Description
	}

	if err := db.DB.Model(&request).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при обновлении заявки"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Заявка успешно обновлена",
		"request": request,
	})
}

func DeleteReport(c *gin.Context) {
	id := c.Param("id")
	var request db.Request

	if err := db.DB.First(&request, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Заявка не найдена"})
		return
	}

	if err := db.DB.Delete(&request).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при удалении заявки"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Заявка успешно удалена"})
}
