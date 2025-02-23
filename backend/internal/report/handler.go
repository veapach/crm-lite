package report

import (
	"backend/internal/db"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/gin-gonic/gin"
)

type ReportData struct {
	Date            string                   `json:"date"`
	Address         string                   `json:"address"`
	Classification  string                   `json:"classification"`
	CustomClass     string                   `json:"customClass"`
	Material        string                   `json:"material"`
	Recommendations string                   `json:"recommendations"`
	Defects         string                   `json:"defects"`
	AdditionalWorks string                   `json:"additionalWorks"`
	Comments        string                   `json:"comments"`
	ChecklistItems  []map[string]interface{} `json:"checklistItems"`
	Photos          []string                 `json:"photos"`
	FirstName       string                   `json:"firstName"`
	LastName        string                   `json:"lastName"`
}

func CreateReport(c *gin.Context) {
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

	var reportData ReportData
	if err := c.ShouldBindJSON(&reportData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Неверный формат запроса: %v", err)})
		return
	}

	reportData.FirstName = user.FirstName
	reportData.LastName = user.LastName

	jsonData, err := json.MarshalIndent(reportData, "", "  ")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Ошибка при обработке данных: %v", err)})
		return
	}

	tempFile, err := os.CreateTemp("", "report_data_*.json")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Ошибка при создании временного файла: %v", err)})
		return
	}
	defer os.Remove(tempFile.Name())

	if _, err := tempFile.Write(jsonData); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Ошибка при записи данных: %v", err)})
		return
	}
	tempFile.Close()

	scriptPath := filepath.Join("scripts", "document_generator.py")
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Скрипт Python не найден: %v", err)})
		return
	}

	pythonCmd := "python3"
	if runtime.GOOS == "windows" {
		pythonCmd = "python"
	}
	cmd := exec.Command(pythonCmd, scriptPath, tempFile.Name())

	output, err := cmd.CombinedOutput()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Ошибка при генерации документа: %v\nOutput: %s", err, string(output)),
		})
		return
	}

	outputStr := strings.TrimSpace(string(output))
	outputStr = strings.ReplaceAll(outputStr, "\r", "")
	outputStr = strings.ReplaceAll(outputStr, "\n", "")
	outputStr = strings.TrimPrefix(outputStr, "\ufeff")
	parts := strings.Split(outputStr, "|")
	if len(parts) != 2 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Некорректный вывод от Python скрипта"})
		return
	}
	filePath, displayName := parts[0], parts[1]

	fileName := filepath.Base(filePath)
	relativeFilePath := filepath.Join("uploads", "reports", fileName)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Сгенерированный файл не найден: %v", err)})
		return
	}

	report := db.Report{
		Filename: strings.TrimSpace(relativeFilePath),
		Date:     reportData.Date,
		Address:  reportData.Address,
		UserID:   userID.(uint),
	}

	if result := db.DB.Create(&report); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Ошибка при сохранении в БД: %v", result.Error)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Отчет успешно создан",
		"report":      report,
		"displayName": displayName,
		"id":          report.ID,
	})
}

func GetReportsHandler(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	showOnlyMine := c.DefaultQuery("onlyMine", "true")
	var reports []db.Report
	query := db.DB

	if showOnlyMine == "true" {
		query = query.Where("user_id = ?", userID)
	}

	if err := query.Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении отчетов"})
		return
	}

	c.JSON(http.StatusOK, reports)
}
