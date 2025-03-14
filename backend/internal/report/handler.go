package report

import (
	"backend/internal/db"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

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

func DeleteReport(c *gin.Context) {
	reportName := c.Param("reportname")

	var reportPath string
	if strings.Contains(reportName, "uploads") || strings.Contains(reportName, "reports") {
		reportPath = reportName
	} else {
		reportPath = filepath.Join("uploads", "reports", reportName)
	}

	if _, err := os.Stat(reportPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
		return
	}

	if err := os.Remove(reportPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при удалении файла"})
		return
	}

	filename := filepath.Base(reportPath)

	var report db.Report
	if err := db.DB.Where("filename = ? OR filename LIKE ?", reportPath, "%"+filename).First(&report).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Отчет не найден в базе данных"})
		return
	}

	if err := db.DB.Delete(&report).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при удалении данных из БД"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Отчет успешно удален"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат данных"})
		return
	}

	if reportData.Address != "" {
		var existingAddress db.Address
		if err := db.DB.Where("address = ?", strings.TrimSpace(reportData.Address)).First(&existingAddress).Error; err != nil {
			newAddress := db.Address{
				Address: strings.TrimSpace(reportData.Address),
			}
			if err := db.DB.Create(&newAddress).Error; err != nil {
				log.Printf("Ошибка при добавлении нового адреса: %v", err)
			}
		}
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

	displayName := strings.TrimSpace(string(output))
	displayName = strings.ReplaceAll(displayName, "\r", "")
	displayName = strings.ReplaceAll(displayName, "\n", "")
	displayName = strings.TrimPrefix(displayName, "\ufeff")

	filePath := "uploads/reports/" + strings.TrimSpace(displayName)
	filePath = filepath.Clean(filePath)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Сгенерированный файл не найден: %v", err)})
		return
	}

	report := db.Report{
		Filename: displayName,
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

func UploadReport(c *gin.Context) {
	_, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "не удалось получить файл"})
		return
	}
	defer file.Close()

	date := c.PostForm("date")
	address := c.PostForm("address")
	reportUserID := c.PostForm("userId")

	if date == "" || address == "" || reportUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "не все поля заполнены"})
		return
	}

	var reportUser db.User
	if err := db.DB.First(&reportUser, reportUserID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "указанный пользователь не найден"})
		return
	}

	if err := os.MkdirAll("uploads/reports", 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка при создании директории для отчетов"})
		return
	}

	timestamp := time.Now().Format("20060102_150405")
	fileExt := filepath.Ext(header.Filename)
	fileName := fmt.Sprintf("%s_%s%s", timestamp, strings.ReplaceAll(address, " ", "_"), fileExt)
	filePath := filepath.Join("uploads/reports", fileName)

	out, err := os.Create(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка при создании файла на сервере"})
		return
	}
	defer out.Close()

	_, err = io.Copy(out, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка при сохранении файла"})
		return
	}

	report := db.Report{
		Filename: fileName,
		Date:     date,
		Address:  address,
		UserID:   reportUser.ID,
	}

	if err := db.DB.Create(&report).Error; err != nil {
		os.Remove(filePath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка при сохранении информации в базу данных"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Отчет успешно загружен",
		"report":  report,
	})
}
