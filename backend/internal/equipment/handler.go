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

	var equipmentMemoryList []db.EquipmentMemory
	if err := db.DB.Where("address = ? AND classification = ?", address, dbClassification).Find(&equipmentMemoryList).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении оборудования"})
		return
	}

	if len(equipmentMemoryList) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Оборудование не найдено"})
		return
	}

	c.JSON(http.StatusOK, equipmentMemoryList)
}

func SaveEquipmentMemory(c *gin.Context) {
	var input struct {
		Address        string `json:"address"`
		Classification string `json:"classification"`
		Items          []struct {
			Name     string `json:"name"`
			Number   string `json:"number"`
			Quantity int    `json:"quantity"`
		} `json:"items"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат данных"})
		return
	}

	if input.Address == "" || input.Classification == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Необходимо указать адрес и классификацию"})
		return
	}

	// Преобразуем "Аварийный вызов" в "АВ" для сохранения в БД
	dbClassification := input.Classification
	if input.Classification == "Аварийный вызов" {
		dbClassification = "АВ"
	}

	// Удаляем все старые записи для этого адреса и классификации
	db.DB.Where("address = ? AND classification = ?", input.Address, dbClassification).Delete(&db.EquipmentMemory{})

	// Создаём новые записи
	var savedItems []db.EquipmentMemory
	for _, item := range input.Items {
		if item.Name == "" {
			continue
		}
		quantity := item.Quantity
		if quantity < 1 {
			quantity = 1
		}
		newMemory := db.EquipmentMemory{
			Address:        input.Address,
			Classification: dbClassification,
			MachineName:    strings.TrimSpace(item.Name),
			MachineNumber:  strings.TrimSpace(item.Number),
			Quantity:       quantity,
		}
		if err := db.DB.Create(&newMemory).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при сохранении данных"})
			return
		}
		savedItems = append(savedItems, newMemory)
	}

	c.JSON(http.StatusOK, savedItems)
}
