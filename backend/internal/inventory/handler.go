package inventory

import (
	"backend/internal/db"
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetInventory(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	var inventory []db.Inventory
	if err := db.DB.Preload("Engineer").Where("engineer_id = ?", userID).Find(&inventory).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении списка ЗИП"})
		return
	}

	c.JSON(http.StatusOK, inventory)
}

func GetItemById(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	id := c.Param("id")
	var item db.Inventory
	if err := db.DB.Preload("Engineer").Where("id = ? AND engineer_id = ?", id, userID).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Предмет из списка не найден"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func AddInventoryItem(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	var input struct {
		ObjectNumber string `json:"objectNumber" binding:"required"`
		ZipName      string `json:"zipName" binding:"required"`
		Quantity     *int   `json:"quantity"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректные данные"})
		return
	}

	var existing db.Inventory
	err := db.DB.Where("object_number = ? AND zip_name = ? AND engineer_id = ? AND status != ?", input.ObjectNumber, input.ZipName, userID, "установлен").First(&existing).Error
	if err == nil {
		addQty := 1
		if input.Quantity != nil && *input.Quantity > 0 {
			addQty = *input.Quantity
		}
		existing.Quantity += addQty
		if err := db.DB.Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при увеличении количества"})
			return
		}
		c.JSON(http.StatusOK, existing)
		return
	}

	qty := 1
	if input.Quantity != nil && *input.Quantity > 0 {
		qty = *input.Quantity
	}
	inventory := db.Inventory{
		ObjectNumber: input.ObjectNumber,
		ZipName:      input.ZipName,
		Status:       "не куплено",
		Quantity:     qty,
		EngineerID:   userID.(uint),
	}
	if err := db.DB.Create(&inventory).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при добавлении"})
		return
	}
	c.JSON(http.StatusOK, inventory)
}

func UpdateInventoryItem(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}
	id := c.Param("id")

	var item db.Inventory
	if err := db.DB.Where("id = ? AND engineer_id = ?", id, userID).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ЗИП не найден"})
		return
	}

	var input struct {
		ObjectNumber *string `json:"objectNumber"`
		ZipName      *string `json:"zipName"`
		Status       *string `json:"status"`
		Quantity     *int    `json:"quantity"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректные данные"})
		return
	}
	if input.ObjectNumber != nil {
		item.ObjectNumber = *input.ObjectNumber
	}
	if input.ZipName != nil {
		item.ZipName = *input.ZipName
	}
	if input.Status != nil {
		item.Status = *input.Status
	}
	if input.Quantity != nil && *input.Quantity > 0 {
		item.Quantity = *input.Quantity
	}
	if err := db.DB.Save(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при обновлении"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func DeleteInventoryItem(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}
	id := c.Param("id")
	if err := db.DB.Where("id = ? AND engineer_id = ?", id, userID).Delete(&db.Inventory{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при удалении"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"result": "ok"})
}
