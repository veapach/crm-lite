package equipment

import (
	"backend/internal/db"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func GetEquipment(c *gin.Context) {
	query := c.Query("query")

	var equipment []db.Equipment
	dbQuery := db.DB

	if query != "" {
		dbQuery = dbQuery.Where("equipment LIKE ?", "%"+query+"%")
	}

	if err := dbQuery.Find(&equipment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении оборудования"})
		return
	}

	c.JSON(http.StatusOK, equipment)
}

func AddEquipment(c *gin.Context) {
	var input struct {
		Equipment string `json:"equipment" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат данных"})
		return
	}

	var existingEquipment db.Equipment
	if err := db.DB.Where("equipment = ?", strings.TrimSpace(input.Equipment)).First(&existingEquipment).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Такое оборудование уже добавлено"})
		return
	}

	equipment := db.Equipment{
		Equipment: strings.TrimSpace(input.Equipment),
	}

	if err := db.DB.Create(&equipment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при добавлении оборудования"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Оборудование успешно добавлено", "equipment": equipment})
}

func DeleteEquipment(c *gin.Context) {
	id := c.Param("id")

	if err := db.DB.Delete(&db.Equipment{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при удалении оборудования"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Оборудование успешно удалено"})
}
