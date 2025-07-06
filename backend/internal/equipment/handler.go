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

func GetEquipmentMemory(c *gin.Context) {
	address := c.Query("address")
	classification := c.Query("classification")

	if address == "" || classification == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Необходимо указать адрес и классификацию"})
		return
	}

	// Преобразуем "Аварийный вызов" в "АВ" для поиска в БД
	dbClassification := classification
	if classification == "Аварийный вызов" {
		dbClassification = "АВ"
	}

	var equipmentMemory db.EquipmentMemory
	if err := db.DB.Where("address = ? AND classification = ?", address, dbClassification).First(&equipmentMemory).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Оборудование не найдено"})
		return
	}

	c.JSON(http.StatusOK, equipmentMemory)
}

func SaveEquipmentMemory(c *gin.Context) {
	var equipmentMemory db.EquipmentMemory
	if err := c.ShouldBindJSON(&equipmentMemory); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат данных"})
		return
	}

	if equipmentMemory.Address == "" || equipmentMemory.Classification == "" || equipmentMemory.MachineName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Необходимо указать адрес, классификацию и название оборудования"})
		return
	}

	// Преобразуем "Аварийный вызов" в "АВ" для сохранения в БД
	dbClassification := equipmentMemory.Classification
	if equipmentMemory.Classification == "Аварийный вызов" {
		dbClassification = "АВ"
	}

	var existing db.EquipmentMemory
	if err := db.DB.Where("address = ? AND classification = ?", equipmentMemory.Address, dbClassification).First(&existing).Error; err == nil {
		existing.MachineName = equipmentMemory.MachineName
		existing.MachineNumber = equipmentMemory.MachineNumber
		existing.Count++
		if err := db.DB.Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при обновлении данных"})
			return
		}
		c.JSON(http.StatusOK, existing)
		return
	}

	equipmentMemory.Classification = dbClassification
	equipmentMemory.Count = 1
	if err := db.DB.Create(&equipmentMemory).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при сохранении данных"})
		return
	}

	c.JSON(http.StatusOK, equipmentMemory)
}
