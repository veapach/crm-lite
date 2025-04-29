package report

import (
	"archive/zip"
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

	"backend/internal/db"
)

type ReportData struct {
	Date             string                   `json:"date"`
	Address          string                   `json:"address"`
	Machine_name     string                   `json:"machine_name"`
	Machine_number   string                   `json:"machine_number"`
	Inventory_number string                   `json:"inventory_number"`
	Classification   string                   `json:"classification"`
	CustomClass      string                   `json:"customClass"`
	Material         string                   `json:"material"`
	Recommendations  string                   `json:"recommendations"`
	Defects          string                   `json:"defects"`
	AdditionalWorks  string                   `json:"additionalWorks"`
	Comments         string                   `json:"comments"`
	ChecklistItems   []map[string]interface{} `json:"checklistItems"`
	Photos           []string                 `json:"photos"`
	FirstName        string                   `json:"firstName"`
	LastName         string                   `json:"lastName"`
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
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": "Ошибка при получении данных пользователя"},
		)
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

	// Map specific classifications to their database values
	if reportData.Classification == "ТО Китчен" || reportData.Classification == "ТО Пекарня" {
		reportData.Classification = "ТО"
	} else if reportData.Classification == "Аварийный вызов" {
		reportData.Classification = "АВ"
	} else if reportData.Classification == "ПНР" {
		reportData.Classification = "пнр"
	}

	reportData.FirstName = user.FirstName
	reportData.LastName = user.LastName

	jsonData, err := json.MarshalIndent(reportData, "", "  ")
	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": fmt.Sprintf("Ошибка при обработке данных: %v", err)},
		)
		return
	}

	tempFile, err := os.CreateTemp("", "report_data_*.json")
	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": fmt.Sprintf("Ошибка при создании временного файла: %v", err)},
		)
		return
	}
	defer os.Remove(tempFile.Name())

	if _, err := tempFile.Write(jsonData); err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": fmt.Sprintf("Ошибка при записи данных: %v", err)},
		)
		return
	}

	tempFile.Close()

	scriptPath := filepath.Join("scripts", "document_generator.py")
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": fmt.Sprintf("Скрипт Python не найден: %v", err)},
		)
		return
	}

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		pythonPath := filepath.Join("scripts", "venv", "Scripts", "python.exe")
		cmd = exec.Command(pythonPath, scriptPath, tempFile.Name())
	} else {
		pythonPaths := []string{
			filepath.Join("scripts", "venv", "bin", "python3"),
			filepath.Join("scripts", "venv", "bin", "python"),
			"python3",
			"python",
		}

		var pythonPath string
		for _, path := range pythonPaths {
			if _, err := exec.LookPath(path); err == nil {
				pythonPath = path
				break
			}
		}

		if pythonPath == "" {
			c.JSON(
				http.StatusInternalServerError,
				gin.H{"error": "Python интерпретатор не найден"},
			)
			return
		}

		cmd = exec.Command(pythonPath, scriptPath, tempFile.Name())
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf(
				"Ошибка при генерации документа: %v\nOutput: %s",
				err,
				string(output),
			),
		})
		return
	}

	lines := strings.Split(string(output), "\n")
	var displayName string
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimSpace(lines[i])
		if line != "" && !strings.Contains(line, "%") && strings.HasSuffix(line, ".pdf") {
			displayName = line
			break
		}
	}

	if displayName == "" {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": "Не удалось получить имя сгенерированного файла"},
		)
		return
	}

	displayName = strings.TrimSpace(displayName)
	displayName = strings.ReplaceAll(displayName, "\r", "")
	displayName = strings.TrimPrefix(displayName, "\ufeff")

	filePath := "uploads/reports/" + displayName
	filePath = filepath.Clean(filePath)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": fmt.Sprintf("Сгенерированный файл не найден: %v", err)},
		)
		return
	}

	report := db.Report{
		Filename:       displayName,
		Date:           reportData.Date,
		Address:        reportData.Address,
		UserID:         userID.(uint),
		Classification: reportData.Classification,
	}

	if result := db.DB.Create(&report); result.Error != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": fmt.Sprintf("Ошибка при сохранении в БД: %v", result.Error)},
		)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Отчет успешно создан",
		"report":      report,
		"displayName": displayName,
		"id":          report.ID,
	})
}

func GetReportsCount(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	endOfMonth := startOfMonth.AddDate(0, 1, 0).Add(-time.Second)

	startDate := c.Query("startDate")
	endDate := c.Query("endDate")

	var totalCount, monthCount, toCount, avCount, pnrCount int64
	var filteredTotal, filteredTo, filteredAv, filteredPnr int64

	if err := db.DB.Model(&db.Report{}).Where("user_id = ?", userID).Count(&totalCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении общего кол-ва отчетов"})
		return
	}

	if err := db.DB.Model(&db.Report{}).
		Where("user_id = ? AND date BETWEEN ? AND ?", userID, startOfMonth.Format("2006-01-02"), endOfMonth.Format("2006-01-02")).
		Count(&monthCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении кол-ва отчетов за месяц"})
		return
	}

	if err := db.DB.Model(&db.Report{}).
		Where("user_id = ? AND classification = ?", userID, "ТО").
		Count(&toCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении кол-ва отчетов с классификацией ТО"})
		return
	}

	if err := db.DB.Model(&db.Report{}).
		Where("user_id = ? AND classification = ?", userID, "АВ").
		Count(&avCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении кол-ва отчетов с классификацией АВ"})
		return
	}

	if err := db.DB.Model(&db.Report{}).
		Where("user_id = ? AND classification = ?", userID, "пнр").
		Count(&pnrCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении кол-ва отчетов с классификацией ПНР"})
		return
	}

	if startDate != "" && endDate != "" {
		if err := db.DB.Model(&db.Report{}).
			Where("user_id = ? AND date BETWEEN ? AND ?", userID, startDate, endDate).
			Count(&filteredTotal).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении общего кол-ва отфильтрованных отчетов"})
			return
		}

		if err := db.DB.Model(&db.Report{}).
			Where("user_id = ? AND classification = ? AND date BETWEEN ? AND ?", userID, "ТО", startDate, endDate).
			Count(&filteredTo).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении кол-ва отфильтрованных отчетов с классификацией ТО"})
			return
		}

		if err := db.DB.Model(&db.Report{}).
			Where("user_id = ? AND classification = ? AND date BETWEEN ? AND ?", userID, "АВ", startDate, endDate).
			Count(&filteredAv).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении кол-ва отфильтрованных отчетов с классификацией АВ"})
			return
		}

		if err := db.DB.Model(&db.Report{}).
			Where("user_id = ? AND classification = ? AND date BETWEEN ? AND ?", userID, "пнр", startDate, endDate).
			Count(&filteredPnr).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении кол-ва отфильтрованных отчетов с классификацией ПНР"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"total":         totalCount,
		"month":         monthCount,
		"to":            toCount,
		"av":            avCount,
		"pnr":           pnrCount,
		"filteredTotal": filteredTotal,
		"filteredTo":    filteredTo,
		"filteredAv":    filteredAv,
		"filteredPnr":   filteredPnr,
	})
}

func GetReportsHandler(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	showOnlyMine := c.DefaultQuery("onlyMine", "true")
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")

	var reports []db.Report
	query := db.DB

	if showOnlyMine == "true" {
		query = query.Where("user_id = ?", userID)
	}

	if startDate != "" && endDate != "" {
		query = query.Where("date BETWEEN ? AND ?", startDate, endDate)
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
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": "ошибка при создании директории для отчетов"},
		)
		return
	}

	timestamp := time.Now().Format("20060102_150405")
	fileExt := filepath.Ext(header.Filename)
	fileName := fmt.Sprintf("%s_%s%s", timestamp, strings.ReplaceAll(address, " ", "_"), fileExt)
	filePath := filepath.Join("uploads/reports", fileName)

	out, err := os.Create(filePath)
	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": "ошибка при создании файла на сервере"},
		)
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
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": "ошибка при сохранении информации в базу данных"},
		)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Отчет успешно загружен",
		"report":  report,
	})
}

func DownloadMonthlyReports(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	endOfMonth := startOfMonth.AddDate(0, 1, 0).Add(-time.Second)

	var reports []db.Report
	if err := db.DB.Where("user_id = ? AND date BETWEEN ? AND ?", userID, startOfMonth.Format("2006-01-02"), endOfMonth.Format("2006-01-02")).Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении отчетов"})
		return
	}

	if len(reports) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Нет отчетов за текущий месяц"})
		return
	}

	tempDir, err := os.MkdirTemp("", "monthly_reports_*")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при создании временной директории"})
		return
	}
	defer os.RemoveAll(tempDir)

	zipFilePath := filepath.Join(tempDir, "reports.zip")
	zipFile, err := os.Create(zipFilePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при создании ZIP файла"})
		return
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	for _, report := range reports {
		reportPath := filepath.Join("uploads", "reports", report.Filename)
		file, err := os.Open(reportPath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при открытии файла отчета"})
			return
		}
		defer file.Close()

		zipEntry, err := zipWriter.Create(report.Filename)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при добавлении файла в ZIP архив"})
			return
		}

		if _, err := io.Copy(zipEntry, file); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при записи файла в ZIP архив"})
			return
		}
	}

	zipWriter.Close()

	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", "attachment; filename=reports.zip")
	c.File(zipFilePath)
}

func DownloadReportsByPeriod(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	startDate := c.Query("startDate")
	endDate := c.Query("endDate")

	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Не указан интервал дат"})
		return
	}

	var reports []db.Report
	if err := db.DB.Where("user_id = ? AND date BETWEEN ? AND ?", userID, startDate, endDate).Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении отчетов"})
		return
	}

	if len(reports) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Нет отчетов за указанный период"})
		return
	}

	tempDir, err := os.MkdirTemp("", "reports_by_period_*")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при создании временной директории"})
		return
	}
	defer os.RemoveAll(tempDir)

	zipFilePath := filepath.Join(tempDir, "reports_by_period.zip")
	zipFile, err := os.Create(zipFilePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при создании ZIP файла"})
		return
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	for _, report := range reports {
		reportPath := filepath.Join("uploads", "reports", report.Filename)
		file, err := os.Open(reportPath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при открытии файла отчета"})
			return
		}
		defer file.Close()

		zipEntry, err := zipWriter.Create(report.Filename)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при добавлении файла в ZIP архив"})
			return
		}

		if _, err := io.Copy(zipEntry, file); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при записи файла в ZIP архив"})
			return
		}
	}

	zipWriter.Close()

	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", "attachment; filename=reports_by_period.zip")
	c.File(zipFilePath)
}
