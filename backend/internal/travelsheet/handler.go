package travelsheet

import (
	"net/http"
	"strconv"
	"time"

	"backend/internal/db"

	"github.com/gin-gonic/gin"
)

type TravelRecordData struct {
	Date       string `json:"date"`
	StartPoint string `json:"startPoint"`
	EndPoint   string `json:"endPoint"`
	Distance   string `json:"distance"`
}

func CreateTravelRecord(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	var recordData TravelRecordData
	if err := c.ShouldBindJSON(&recordData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат данных: " + err.Error()})
		return
	}

	if recordData.Date == "" || recordData.StartPoint == "" || recordData.EndPoint == "" || recordData.Distance == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Все поля обязательны для заполнения"})
		return
	}

	distance, err := strconv.ParseFloat(recordData.Distance, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Километраж должен быть числом"})
		return
	}

	if distance <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Километраж должен быть положительным числом"})
		return
	}

	record := db.TravelRecord{
		Date:       recordData.Date,
		StartPoint: recordData.StartPoint,
		EndPoint:   recordData.EndPoint,
		Distance:   distance,
		UserID:     userID.(uint),
	}

	if err := db.DB.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при создании записи"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Запись успешно создана", "record": record})
}

func GetTravelRecords(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	var records []db.TravelRecord
	if err := db.DB.Where("user_id = ?", userID.(uint)).Order("date DESC, id DESC").Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении записей"})
		return
	}

	c.JSON(http.StatusOK, records)
}

func DeleteTravelRecord(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	recordID := c.Param("id")
	id, err := strconv.ParseUint(recordID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный ID записи"})
		return
	}

	var record db.TravelRecord
	if err := db.DB.Where("id = ? AND user_id = ?", id, userID.(uint)).First(&record).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Запись не найдена"})
		return
	}

	if err := db.DB.Delete(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при удалении записи"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Запись успешно удалена"})
}

func GetDailyStats(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	date := c.Query("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	var total float64
	var count int64

	if err := db.DB.Model(&db.TravelRecord{}).
		Where("user_id = ? AND date = ?", userID.(uint), date).
		Select("COALESCE(SUM(distance), 0), COUNT(*)").Row().Scan(&total, &count); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении статистики"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"total": total,
		"count": count,
		"date":  date,
	})
}

func GetMonthlyStats(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	month := c.Query("month")
	if month == "" {
		month = time.Now().Format("2006-01")
	}

	var total float64
	var count int64

	if err := db.DB.Model(&db.TravelRecord{}).
		Where("user_id = ? AND date LIKE ?", userID.(uint), month+"%").
		Select("COALESCE(SUM(distance), 0), COUNT(*)").Row().Scan(&total, &count); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении статистики"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"total": total,
		"count": count,
		"month": month,
	})
}
