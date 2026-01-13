package report

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"backend/internal/db"
	"backend/internal/docgen"
	"backend/internal/storage"
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
	UserId           uint                     `json:"userId"`
	TicketID         *uint                    `json:"ticketId"` // ID заявки для привязки (опционально)
}

func DeleteReport(c *gin.Context) {
	reportName := c.Param("reportname")

	var reportPath string
	if strings.Contains(reportName, "uploads") || strings.Contains(reportName, "reports") {
		reportPath = reportName
	} else {
		reportPath = filepath.Join("uploads", "reports", reportName)
	}

	if _, err := os.Stat(reportPath); err == nil {
		_ = os.Remove(reportPath)
	}

	filename := filepath.Base(reportPath)

	if storage.IsS3Enabled() {
		_ = storage.DeleteReportObject(context.Background(), "reports/"+filename)
		_ = storage.DeleteReportObject(context.Background(), "previews/"+strings.TrimSuffix(filename, filepath.Ext(filename))+".png")
	} else {
		previewPath := filepath.Join("uploads", "previews", strings.TrimSuffix(filename, filepath.Ext(filename))+".png")
		if _, err := os.Stat(previewPath); err == nil {
			_ = os.Remove(previewPath)
		}
	}

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

func getUniqueS3FileName(ctx context.Context, prefix, baseName string) string { // добавлено
	ext := filepath.Ext(baseName)
	name := strings.TrimSuffix(baseName, ext)
	newName := baseName
	counter := 1

	for {
		key := prefix + newName
		_, _, err := storage.GetReportObject(ctx, key)
		if err != nil {
			// объекта нет — значит имя уникально
			return newName
		}
		newName = fmt.Sprintf("%s(%d)%s", name, counter, ext)
		counter++
	}
}

// linkReportToTicket привязывает отчёт к конкретной заявке
func linkReportToTicket(reportID uint, ticketID uint) {
	// Проверяем, не привязан ли уже этот отчёт к этой заявке
	var existing db.TicketReport
	if err := db.DB.Where("ticket_id = ? AND report_id = ?", ticketID, reportID).First(&existing).Error; err == nil {
		// Уже привязан
		return
	}

	// Создаём связь
	ticketReport := db.TicketReport{
		TicketID:  ticketID,
		ReportID:  reportID,
		CreatedAt: time.Now().Format("2006-01-02 15:04:05"),
	}
	if err := db.DB.Create(&ticketReport).Error; err != nil {
		log.Printf("Ошибка при привязке отчёта %d к заявке %d: %v", reportID, ticketID, err)
	} else {
		log.Printf("Отчёт %d привязан к заявке %d", reportID, ticketID)
	}
}

// autoLinkReportToTickets автоматически привязывает отчёт к последней заявке по адресу
// Используется только если ticketID не указан явно
func autoLinkReportToTickets(reportID uint, address string) {
	if address == "" {
		return
	}

	// Ищем последнюю заявку с таким же адресом (любой статус кроме отменённых)
	var ticket db.ClientTicket
	if err := db.DB.Where("address = ? AND status != ?", address, "Отменено").
		Order("date DESC, id DESC").
		First(&ticket).Error; err != nil {
		log.Printf("Заявок по адресу %s не найдено для автопривязки", address)
		return
	}

	linkReportToTicket(reportID, ticket.ID)
}

func CreateReport(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}

	var reportData ReportData
	if err := c.ShouldBindJSON(&reportData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат данных"})
		return
	}

	// Если явно передан userId (исполнитель), используем его, иначе текущий userID
	var execUserId uint
	if reportData.UserId != 0 {
		execUserId = reportData.UserId
	} else if id, ok := userID.(uint); ok {
		execUserId = id
	} else if id, ok := userID.(int); ok {
		execUserId = uint(id)
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось определить исполнителя"})
		return
	}

	var user db.User
	if err := db.DB.First(&user, execUserId).Error; err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": "Ошибка при получении данных исполнителя"},
		)
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

	if reportData.Address != "" && reportData.Classification != "" && reportData.Machine_name != "" {
		var existingMemory db.EquipmentMemory
		if err := db.DB.Where("address = ? AND classification = ?", reportData.Address, reportData.Classification).First(&existingMemory).Error; err == nil {
			existingMemory.MachineName = reportData.Machine_name
			existingMemory.MachineNumber = reportData.Machine_number
			existingMemory.Count++
			if err := db.DB.Save(&existingMemory).Error; err != nil {
				log.Printf("Ошибка при обновлении памяти оборудования: %v", err)
			}
		} else {
			newMemory := db.EquipmentMemory{
				Address:        reportData.Address,
				Classification: reportData.Classification,
				MachineName:    reportData.Machine_name,
				MachineNumber:  reportData.Machine_number,
				Count:          1,
			}
			if err := db.DB.Create(&newMemory).Error; err != nil {
				log.Printf("Ошибка при создании памяти оборудования: %v", err)
			}
		}
	}

	if reportData.Classification == "Аварийный вызов" {
		reportData.Classification = "АВ"
	}

	reportData.FirstName = user.FirstName
	reportData.LastName = user.LastName

	pyServiceURL := os.Getenv("PY_SERVICE_URL")
	if pyServiceURL != "" && storage.IsS3Enabled() {
		payload, _ := json.Marshal(reportData)
		req, err := http.NewRequest(http.MethodPost, pyServiceURL, bytes.NewReader(payload))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			cli := &http.Client{Timeout: 120 * time.Second}
			resp, err := cli.Do(req)
			if err == nil && resp.StatusCode == http.StatusOK {
				defer resp.Body.Close()
				var out struct {
					PDF     string `json:"pdf"`
					Preview string `json:"preview"`
				}
				dec := json.NewDecoder(resp.Body)
				if err := dec.Decode(&out); err == nil && strings.HasSuffix(out.PDF, ".pdf") {
					report := db.Report{
						Filename:       filepath.Base(out.PDF),
						Date:           reportData.Date,
						Address:        reportData.Address,
						UserID:         execUserId,
						Classification: reportData.Classification,
					}
					if result := db.DB.Create(&report); result.Error != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Ошибка при сохранении в БД: %v", result.Error)})
						return
					}
					// Привязка отчёта к заявке
					if reportData.TicketID != nil && *reportData.TicketID > 0 {
						linkReportToTicket(report.ID, *reportData.TicketID)
					} else {
						autoLinkReportToTickets(report.ID, reportData.Address)
					}
					respMap := gin.H{
						"message":     "Отчет успешно создан",
						"report":      report,
						"displayName": report.Filename,
						"id":          report.ID,
					}
					if out.Preview != "" {
						respMap["previewName"] = filepath.Base(out.Preview)
					}
					c.JSON(http.StatusOK, respMap)
					return
				}
			}
		}
	}

	// Попытка использовать gRPC сервис генерации документов
	grpcClient, err := docgen.GetClientFromEnv()
	if err == nil && grpcClient != nil {
		defer grpcClient.Close()

		// Преобразуем checklistItems
		var checklistItems []*docgen.ChecklistItem
		for _, item := range reportData.ChecklistItems {
			if task, ok := item["task"].(string); ok {
				done, _ := item["done"].(bool)
				checklistItems = append(checklistItems, &docgen.ChecklistItem{
					Task: task,
					Done: done,
				})
			}
		}

		// Создаём gRPC запрос
		req := &docgen.GenerateDocumentRequest{
			Date:            reportData.Date,
			Address:         reportData.Address,
			MachineName:     reportData.Machine_name,
			MachineNumber:   reportData.Machine_number,
			InventoryNumber: reportData.Inventory_number,
			Classification:  reportData.Classification,
			CustomClass:     reportData.CustomClass,
			Material:        reportData.Material,
			Recommendations: reportData.Recommendations,
			Defects:         reportData.Defects,
			AdditionalWorks: reportData.AdditionalWorks,
			Comments:        reportData.Comments,
			ChecklistItems:  checklistItems,
			Photos:          reportData.Photos,
			FirstName:       reportData.FirstName,
			LastName:        reportData.LastName,
		}

		ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
		defer cancel()

		resp, err := grpcClient.GenerateDocument(ctx, req)
		if err == nil && resp.Success {
			// Успешная генерация через gRPC
			displayName := resp.PdfFilename
			previewName := resp.PreviewFilename

			// Если есть контент, сохраняем файлы
			if len(resp.PdfContent) > 0 {
				uploadsDir := filepath.Join("uploads", "reports")
				os.MkdirAll(uploadsDir, 0755)
				filePath := filepath.Join(uploadsDir, displayName)
				if err := os.WriteFile(filePath, resp.PdfContent, 0644); err != nil {
					log.Printf("Ошибка при сохранении PDF: %v", err)
				}
			}

			if len(resp.PreviewContent) > 0 && previewName != "" {
				previewsDir := filepath.Join("uploads", "previews")
				os.MkdirAll(previewsDir, 0755)
				previewPath := filepath.Join(previewsDir, previewName)
				if err := os.WriteFile(previewPath, resp.PreviewContent, 0644); err != nil {
					log.Printf("Ошибка при сохранении превью: %v", err)
				}
			}

			filePath := filepath.Clean(filepath.Join("uploads", "reports", displayName))

			if storage.IsS3Enabled() {
				f, err := os.Open(filePath)
				if err == nil {
					defer f.Close()
					info, _ := f.Stat()

					ext := filepath.Ext(displayName)
					base := strings.TrimSuffix(displayName, ext)
					uniqueName := displayName
					counter := 1

					for {
						key := "reports/" + uniqueName
						obj, _, e := storage.GetReportObject(context.Background(), key)
						if e == nil && obj != nil {
							obj.Close()
							uniqueName = fmt.Sprintf("%s(%d)%s", base, counter, ext)
							counter++
							continue
						}
						break
					}

					_, _ = f.Seek(0, 0)
					_ = storage.UploadReportObject(context.Background(), "reports/"+uniqueName, f, info.Size(), "application/pdf")
					_ = os.Remove(filePath)
					displayName = uniqueName

					if previewName != "" {
						p := filepath.Clean(filepath.Join("uploads", "previews", previewName))
						pf, err := os.Open(p)
						if err == nil {
							defer pf.Close()
							pinfo, _ := pf.Stat()

							pext := filepath.Ext(previewName)
							pbase := strings.TrimSuffix(previewName, pext)
							pUnique := previewName
							pCounter := 1

							for {
								pKey := "previews/" + pUnique
								pObj, _, pe := storage.GetReportObject(context.Background(), pKey)
								if pe == nil && pObj != nil {
									pObj.Close()
									pUnique = fmt.Sprintf("%s(%d)%s", pbase, pCounter, pext)
									pCounter++
									continue
								}
								break
							}

							_, _ = pf.Seek(0, 0)
							_ = storage.UploadReportObject(context.Background(), "previews/"+pUnique, pf, pinfo.Size(), "image/png")
							_ = os.Remove(p)
							previewName = pUnique
						}
					}
				} else {
					_ = os.Remove(filePath)
				}
			}

			report := db.Report{
				Filename:       displayName,
				Date:           reportData.Date,
				Address:        reportData.Address,
				UserID:         execUserId,
				Classification: reportData.Classification,
			}

			if result := db.DB.Create(&report); result.Error != nil {
				c.JSON(
					http.StatusInternalServerError,
					gin.H{"error": fmt.Sprintf("Ошибка при сохранении в БД: %v", result.Error)},
				)
				return
			}

			// Привязка отчёта к заявке
			if reportData.TicketID != nil && *reportData.TicketID > 0 {
				linkReportToTicket(report.ID, *reportData.TicketID)
			} else {
				autoLinkReportToTickets(report.ID, reportData.Address)
			}

			respMap := gin.H{
				"message":     "Отчет успешно создан",
				"report":      report,
				"displayName": displayName,
				"id":          report.ID,
			}
			if previewName != "" {
				respMap["previewName"] = previewName
			}
			c.JSON(http.StatusOK, respMap)
			return
		}
	}

	// Fallback: использование прямого вызова Python скрипта через exec
	log.Println("Используется fallback метод генерации документов через exec")

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

	scriptPath := filepath.Join("scripts", "document_generator_core.py")
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
	var previewName string
	for _, lineRaw := range lines {
		line := strings.TrimSpace(strings.ReplaceAll(strings.TrimPrefix(lineRaw, "\ufeff"), "\r", ""))
		if line == "" || strings.Contains(line, "%") {
			continue
		}
		if strings.HasSuffix(line, ".pdf") {
			displayName = line
		}
		if strings.HasSuffix(line, ".png") {
			previewName = line
		}
	}

	if displayName == "" {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": "Не удалось получить имя сгенерированного файла"},
		)
		return
	}

	filePath := filepath.Clean(filepath.Join("uploads", "reports", displayName))
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": fmt.Sprintf("Сгенерированный файл не найден: %v", err)},
		)
		return
	}

	if storage.IsS3Enabled() {
		f, err := os.Open(filePath)
		if err == nil {
			defer f.Close()
			info, _ := f.Stat()

			ext := filepath.Ext(displayName)
			base := strings.TrimSuffix(displayName, ext)
			uniqueName := displayName
			counter := 1

			for {
				key := "reports/" + uniqueName
				obj, _, e := storage.GetReportObject(context.Background(), key)
				if e == nil && obj != nil {
					obj.Close()
					uniqueName = fmt.Sprintf("%s(%d)%s", base, counter, ext)
					counter++
					continue
				}
				break
			}

			_, _ = f.Seek(0, 0)
			_ = storage.UploadReportObject(context.Background(), "reports/"+uniqueName, f, info.Size(), "application/pdf")
			_ = os.Remove(filePath)
			displayName = uniqueName

			if previewName != "" {
				p := filepath.Clean(filepath.Join("uploads", "previews", previewName))
				pf, err := os.Open(p)
				if err == nil {
					defer pf.Close()
					pinfo, _ := pf.Stat()

					pext := filepath.Ext(previewName)
					pbase := strings.TrimSuffix(previewName, pext)
					pUnique := previewName
					pCounter := 1

					for {
						pKey := "previews/" + pUnique
						pObj, _, pe := storage.GetReportObject(context.Background(), pKey)
						if pe == nil && pObj != nil {
							pObj.Close()
							pUnique = fmt.Sprintf("%s(%d)%s", pbase, pCounter, pext)
							pCounter++
							continue
						}
						break
					}

					_, _ = pf.Seek(0, 0)
					_ = storage.UploadReportObject(context.Background(), "previews/"+pUnique, pf, pinfo.Size(), "image/png")
					_ = os.Remove(p)
					previewName = pUnique
				}
			}
		} else {
			_ = os.Remove(filePath)
		}
	}

	report := db.Report{
		Filename:       displayName,
		Date:           reportData.Date,
		Address:        reportData.Address,
		UserID:         execUserId,
		Classification: reportData.Classification,
	}

	if result := db.DB.Create(&report); result.Error != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{"error": fmt.Sprintf("Ошибка при сохранении в БД: %v", result.Error)},
		)
		return
	}

	// Привязка отчёта к заявке
	if reportData.TicketID != nil && *reportData.TicketID > 0 {
		linkReportToTicket(report.ID, *reportData.TicketID)
	} else {
		autoLinkReportToTickets(report.ID, reportData.Address)
	}

	resp := gin.H{
		"message":     "Отчет успешно создан",
		"report":      report,
		"displayName": displayName,
		"id":          report.ID,
	}
	if previewName != "" {
		resp["previewName"] = previewName
	}
	c.JSON(http.StatusOK, resp)
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

	var totalCount, monthCount int64
	var toKitchenCount, toBakeryCount, toKitchenBakeryCount, toCount, avCount, pnrCount int64
	var monthToKitchenBakeryCount int64
	var filteredTotal, filteredToKitchen, filteredToBakery, filteredToKitchenBakery, filteredTo, filteredAv, filteredPnr int64

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

	// Подсчитываем комбинированные отчеты за месяц отдельно
	if err := db.DB.Model(&db.Report{}).
		Where("user_id = ? AND classification = ? AND date BETWEEN ? AND ?", userID, "ТО Китчен/Пекарня", startOfMonth.Format("2006-01-02"), endOfMonth.Format("2006-01-02")).
		Count(&monthToKitchenBakeryCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении кол-ва комбинированных отчетов за месяц"})
		return
	}

	if err := db.DB.Model(&db.Report{}).
		Where("user_id = ? AND classification = ?", userID, "ТО Китчен").
		Count(&toKitchenCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении кол-ва отчетов с классификацией ТО Китчен"})
		return
	}
	if err := db.DB.Model(&db.Report{}).
		Where("user_id = ? AND classification = ?", userID, "ТО Пекарня").
		Count(&toBakeryCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении кол-ва отчетов с классификацией ТО Пекарня"})
		return
	}
	if err := db.DB.Model(&db.Report{}).
		Where("user_id = ? AND classification = ?", userID, "ТО Китчен/Пекарня").
		Count(&toKitchenBakeryCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении кол-ва отчетов с классификацией ТО Китчен/Пекарня"})
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
		Where("user_id = ? AND classification = ?", userID, "ПНР").
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
			Where("user_id = ? AND classification = ? AND date BETWEEN ? AND ?", userID, "ТО Китчен", startDate, endDate).
			Count(&filteredToKitchen).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении кол-ва отфильтрованных отчетов с классификацией ТО Китчен"})
			return
		}
		if err := db.DB.Model(&db.Report{}).
			Where("user_id = ? AND classification = ? AND date BETWEEN ? AND ?", userID, "ТО Пекарня", startDate, endDate).
			Count(&filteredToBakery).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении кол-ва отфильтрованных отчетов с классификацией ТО Пекарня"})
			return
		}
		if err := db.DB.Model(&db.Report{}).
			Where("user_id = ? AND classification = ? AND date BETWEEN ? AND ?", userID, "ТО Китчен/Пекарня", startDate, endDate).
			Count(&filteredToKitchenBakery).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении кол-ва отфильтрованных отчетов с классификацией ТО Китчен/Пекарня"})
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
			Where("user_id = ? AND classification = ? AND date BETWEEN ? AND ?", userID, "ПНР", startDate, endDate).
			Count(&filteredPnr).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении кол-ва отфильтрованных отчетов с классификацией ПНР"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"total":                   totalCount + toKitchenBakeryCount,
		"month":                   monthCount + monthToKitchenBakeryCount,
		"toKitchen":               toKitchenCount,
		"toBakery":                toBakeryCount,
		"toKitchenBakery":         toKitchenBakeryCount,
		"to":                      toCount,
		"av":                      avCount,
		"pnr":                     pnrCount,
		"filteredTotal":           filteredTotal + filteredToKitchenBakery,
		"filteredToKitchen":       filteredToKitchen,
		"filteredToBakery":        filteredToBakery,
		"filteredToKitchenBakery": filteredToKitchenBakery,
		"filteredTo":              filteredTo,
		"filteredAv":              filteredAv,
		"filteredPnr":             filteredPnr,
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
	search := c.Query("search")
	order := c.DefaultQuery("order", "desc") // добавлено
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "12"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 12
	}

	var reports []db.Report
	query := db.DB.Model(&db.Report{})

	if showOnlyMine == "true" {
		query = query.Where("user_id = ?", userID)
	}
	if startDate != "" && endDate != "" {
		query = query.Where("date BETWEEN ? AND ?", startDate, endDate)
	}
	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where(
			"(address ILIKE ? OR date ILIKE ? OR classification ILIKE ? OR filename ILIKE ?)",
			searchPattern, searchPattern, searchPattern, searchPattern,
		)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при подсчете отчетов"})
		return
	}

	// Применяем сортировку
	orderClause := "date DESC"
	if order == "asc" {
		orderClause = "date ASC"
	}

	if err := query.Order(orderClause).Offset((page - 1) * pageSize).Limit(pageSize).Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении отчетов"})
		return
	}

	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
	c.JSON(http.StatusOK, gin.H{
		"reports":    reports,
		"total":      total,
		"totalPages": totalPages,
		"page":       page,
	})
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
	classification := c.PostForm("classification")

	if date == "" || address == "" || reportUserID == "" || classification == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "не все поля заполнены"})
		return
	}

	var reportUser db.User
	if err := db.DB.First(&reportUser, reportUserID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "указанный пользователь не найден"})
		return
	}

	fileName := filepath.Base(header.Filename)

	if storage.IsS3Enabled() {
		ctx := context.Background()
		fileName = getUniqueS3FileName(ctx, "reports/", fileName)
		contentType := header.Header.Get("Content-Type")
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		_ = storage.UploadReportObject(ctx, "reports/"+fileName, file, header.Size, contentType)
	} else {
		if err := os.MkdirAll("uploads/reports", 0755); err != nil {
			c.JSON(
				http.StatusInternalServerError,
				gin.H{"error": "ошибка при создании директории для отчетов"},
			)
			return
		}
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
	}

	report := db.Report{
		Filename:       fileName,
		Date:           date,
		Address:        address,
		UserID:         reportUser.ID,
		Classification: classification,
	}

	if err := db.DB.Create(&report).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при сохранении данных в БД"})
		return
	}

	// Автоматическая привязка отчёта к заявкам по адресу
	autoLinkReportToTickets(report.ID, address)

	c.JSON(http.StatusOK, gin.H{"message": "Отчет успешно загружен"})
}

func DownloadMonthlyReports(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}
	var reports []db.Report
	if err := db.DB.Where("user_id = ?", userID).Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении отчетов"})
		return
	}
	tempDir, err := os.MkdirTemp("", "monthly_reports_*")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при создании временной директории"})
		return
	}
	defer os.RemoveAll(tempDir)
	zipFilePath := filepath.Join(tempDir, "monthly_reports.zip")
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
		var reader io.ReadCloser
		f, err := os.Open(reportPath)
		if err == nil {
			reader = f
		} else if storage.IsS3Enabled() {
			obj, _, e := storage.GetReportObject(context.Background(), "reports/"+report.Filename)
			if e == nil {
				reader = obj
			}
		}
		if reader == nil {
			continue
		}
		w, err := zipWriter.Create(report.Filename)
		if err != nil {
			reader.Close()
			continue
		}
		io.Copy(w, reader)
		reader.Close()
	}
	zipWriter.Close()
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", "attachment; filename=monthly_reports.zip")
	c.File(zipFilePath)
}

func DownloadReportsByPeriod(c *gin.Context) {
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Не указан период"})
		return
	}
	var reports []db.Report
	if err := db.DB.Where("date BETWEEN ? AND ?", startDate, endDate).Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка при получении отчетов"})
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
		var reader io.ReadCloser
		f, err := os.Open(reportPath)
		if err == nil {
			reader = f
		} else if storage.IsS3Enabled() {
			obj, _, e := storage.GetReportObject(context.Background(), "reports/"+report.Filename)
			if e == nil {
				reader = obj
			}
		}
		if reader == nil {
			continue
		}
		w, err := zipWriter.Create(report.Filename)
		if err != nil {
			reader.Close()
			continue
		}
		io.Copy(w, reader)
		reader.Close()
	}
	zipWriter.Close()
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", "attachment; filename=reports_by_period.zip")
	c.File(zipFilePath)
}

type ReportUploadInfo struct {
	Files          []*multipart.FileHeader `form:"files[]"`
	UserID         uint                    `form:"userId"`
	Classification string                  `form:"classification"`
	Date           string                  `form:"date"`
	Address        string                  `form:"address"`
}

func UploadMultipleReports(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2<<30)
	_, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не авторизован"})
		return
	}
	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ошибка при получении файлов"})
		return
	}
	files := form.File["files[]"]
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "файлы не найдены"})
		return
	}
	reportUserID := c.PostForm("userId")
	classification := c.PostForm("classification")
	date := c.PostForm("date")
	if reportUserID == "" || classification == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "не указан пользователь или классификация"})
		return
	}
	userID, err := strconv.ParseUint(reportUserID, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "некорректный ID пользователя"})
		return
	}
	var reportUser db.User
	if err := db.DB.First(&reportUser, userID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "указанный пользователь не найден"})
		return
	}

	buffer := make([]byte, 32*1024)
	reports := make([]db.Report, 0, len(files))
	errors := make([]string, 0)
	dateAddressRegex := regexp.MustCompile(`Акт[_\s]+выполненных[_\s]+работ[_\s]+(\d{4}[-_]\d{2}[-_]\d{2})[_\s]+(.+)\.`)

	uploadedKeys := make([]string, 0)

	for _, f := range files {
		var fileDate, address string
		origName := filepath.Base(f.Filename)
		if date == "" {
			match := dateAddressRegex.FindStringSubmatch(origName)
			if len(match) >= 3 {
				// Нормализуем дату к формату YYYY-MM-DD
				fileDate = strings.ReplaceAll(match[1], "_", "-")
				address = strings.ReplaceAll(match[2], "_", " ")
			} else {
				errors = append(errors, fmt.Sprintf("Неверный формат имени файла: %s", origName))
				continue
			}
		} else {
			fileDate = date
			address = strings.TrimSuffix(origName, filepath.Ext(origName))
		}

		if storage.IsS3Enabled() {
			src, err := f.Open()
			if err != nil {
				errors = append(errors, fmt.Sprintf("Ошибка при открытии файла %s: %v", origName, err))
				continue
			}
			uniqueName := getUniqueS3FileName(context.Background(), "reports/", origName)
			key := "reports/" + uniqueName
			if err := storage.UploadReportObject(context.Background(), key, src, f.Size, "application/octet-stream"); err != nil {
				src.Close()
				errors = append(errors, fmt.Sprintf("Ошибка при загрузке в S3 %s: %v", origName, err))
				continue
			}
			src.Close()
			uploadedKeys = append(uploadedKeys, key)
			reports = append(reports, db.Report{
				Filename:       uniqueName,
				Date:           fileDate,
				Address:        address,
				UserID:         reportUser.ID,
				Classification: classification,
			})
		} else {
			if err := os.MkdirAll("uploads/reports", 0755); err != nil {
				errors = append(errors, "ошибка при создании директории для отчетов")
				continue
			}
			filePath := filepath.Join("uploads/reports", origName)
			src, err := f.Open()
			if err != nil {
				errors = append(errors, fmt.Sprintf("Ошибка при открытии файла %s: %v", origName, err))
				continue
			}
			dst, err := os.Create(filePath)
			if err != nil {
				src.Close()
				errors = append(errors, fmt.Sprintf("Ошибка при создании файла %s: %v", origName, err))
				continue
			}
			_, err = io.CopyBuffer(dst, src, buffer)
			src.Close()
			reports = append(reports, db.Report{
				Filename:       origName, // изменено
				Date:           fileDate,
				Address:        address,
				UserID:         reportUser.ID,
				Classification: classification,
			})
			dst.Close()
			if err != nil {
				os.Remove(filePath)
				errors = append(errors, fmt.Sprintf("Ошибка при копировании файла %s: %v", origName, err))
				continue
			}
		}
	}

	if len(reports) > 0 {
		if err := db.DB.CreateInBatches(reports, 100).Error; err != nil {
			for _, key := range uploadedKeys {
				_ = storage.DeleteReportObject(context.Background(), key)
			}
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Ошибка при сохранении данных в базу",
				"details": err.Error(),
			})
			return
		}
	}

	response := gin.H{
		"message": fmt.Sprintf("Успешно загружено %d из %d отчетов", len(reports), len(files)),
		"success": len(reports),
		"total":   len(files),
	}
	if len(errors) > 0 {
		response["errors"] = errors
	}
	if len(reports) == 0 {
		c.JSON(http.StatusBadRequest, response)
	} else {
		c.JSON(http.StatusOK, response)
	}
}

func DownloadSelectedReports(c *gin.Context) {
	var request struct {
		ReportIDs []int `json:"reportIds"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}
	if len(request.ReportIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No reports selected"})
		return
	}
	var reports []db.Report
	if err := db.DB.Where("id IN ?", request.ReportIDs).Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reports"})
		return
	}
	if len(reports) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No reports found for the selected IDs"})
		return
	}
	tempDir, err := os.MkdirTemp("", "selected_reports_*")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create temporary directory"})
		return
	}
	defer os.RemoveAll(tempDir)
	zipFilePath := filepath.Join(tempDir, "selected_reports.zip")
	zipFile, err := os.Create(zipFilePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ZIP file"})
		return
	}
	defer zipFile.Close()
	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	for _, report := range reports {
		reportPath := filepath.Join("uploads", "reports", report.Filename)
		var reader io.ReadCloser
		var openErr error
		f, err := os.Open(reportPath)
		if err == nil {
			reader = f
		} else if storage.IsS3Enabled() {
			obj, _, e := storage.GetReportObject(context.Background(), "reports/"+report.Filename)
			openErr = e
			reader = obj
		} else {
			openErr = err
		}
		if reader == nil || openErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open report file"})
			return
		}
		zipEntry, err := zipWriter.Create(report.Filename)
		if err != nil {
			reader.Close()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add file to ZIP archive"})
			return
		}
		if _, err := io.Copy(zipEntry, reader); err != nil {
			reader.Close()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write file to ZIP archive"})
			return
		}
		reader.Close()
	}
	zipWriter.Close()
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", "attachment; filename=selected_reports.zip")
	c.File(zipFilePath)
}

func PreviewReport(c *gin.Context) {
	filename := c.Param("filename")
	filePath := filepath.Join("uploads", "reports", filename)
	if _, err := os.Stat(filePath); err == nil {
		c.File(filePath)
		return
	}
	if storage.IsS3Enabled() {
		obj, info, err := storage.GetReportObject(context.Background(), "reports/"+filename)
		if err == nil && obj != nil {
			defer obj.Close()
			c.Header("Content-Type", info.ContentType)
			c.Status(http.StatusOK)
			io.Copy(c.Writer, obj)
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
}

func PreviewReportImage(c *gin.Context) {
	filename := c.Param("filename")

	// Устанавливаем заголовки кэширования - превью статичны и не меняются
	// Кэш на 1 год для браузера, immutable означает что файл не изменится
	c.Header("Cache-Control", "public, max-age=31536000, immutable")

	// Сначала проверяем S3 (основное хранилище)
	if storage.IsS3Enabled() {
		obj, info, err := storage.GetReportObject(context.Background(), "previews/"+filename)
		if err == nil && obj != nil {
			defer obj.Close()
			if info.ContentType != "" {
				c.Header("Content-Type", info.ContentType)
			} else {
				c.Header("Content-Type", "image/png")
			}
			c.Status(http.StatusOK)
			io.Copy(c.Writer, obj)
			return
		}
	}

	// Fallback на локальное хранилище (для старых файлов)
	filePath := filepath.Join("uploads", "previews", filename)
	if _, err := os.Stat(filePath); err == nil {
		c.Header("Content-Type", "image/png")
		c.File(filePath)
		return
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "Файл превью не найден"})
}

func ServeReportFile(c *gin.Context) {
	filename := c.Param("filename")

	// Сначала проверяем S3 (основное хранилище)
	if storage.IsS3Enabled() {
		obj, info, err := storage.GetReportObject(context.Background(), "reports/"+filename)
		if err == nil && obj != nil {
			defer obj.Close()
			if info.ContentType != "" {
				c.Header("Content-Type", info.ContentType)
			} else {
				c.Header("Content-Type", "application/octet-stream")
			}
			c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", url.PathEscape(filename)))
			c.Status(http.StatusOK)
			io.Copy(c.Writer, obj)
			return
		}
	}

	// Fallback на локальное хранилище
	filePath := filepath.Join("uploads", "reports", filename)
	if _, err := os.Stat(filePath); err == nil {
		c.File(filePath)
		return
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
}
