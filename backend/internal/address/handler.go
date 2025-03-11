package address

import (
	"backend/internal/db"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// GetAddresses возвращает список адресов, опционально фильтруя по поисковому запросу
func GetAddresses(c *gin.Context) {
	query := c.Query("query")

	var addresses []db.Address
	dbQuery := db.DB

	if query != "" {
		dbQuery = dbQuery.Where("address LIKE ?", "%"+query+"%")
	}

	if err := dbQuery.Find(&addresses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении адресов"})
		return
	}

	c.JSON(http.StatusOK, addresses)
}

// AddAddress добавляет новый адрес в базу данных
func AddAddress(c *gin.Context) {
	var input struct {
		Address string `json:"address" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат данных"})
		return
	}

	// Проверяем, существует ли уже такой адрес
	var existingAddress db.Address
	if err := db.DB.Where("address = ?", strings.TrimSpace(input.Address)).First(&existingAddress).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Такой адрес уже существует"})
		return
	}

	address := db.Address{
		Address: strings.TrimSpace(input.Address),
	}

	if err := db.DB.Create(&address).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при добавлении адреса"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Адрес успешно добавлен", "address": address})
}

// DeleteAddress удаляет адрес из базы данных
func DeleteAddress(c *gin.Context) {
	id := c.Param("id")

	if err := db.DB.Delete(&db.Address{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при удалении адреса"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Адрес успешно удален"})
}
