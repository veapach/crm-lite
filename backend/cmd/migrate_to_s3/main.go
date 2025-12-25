package main

import (
	"context"
	"fmt"
	"log"
	"mime"
	"os"
	"path/filepath"
	"strings"

	"backend/internal/storage"

	"github.com/joho/godotenv"
)

var foldersToMigrate = map[string]string{
	"files":    "files/",
	"previews": "previews/",
	"tickets":  "tickets/",
}

func main() {
	// Загружаем .env файл
	if err := godotenv.Load(); err != nil {
		log.Printf("Предупреждение: .env файл не найден: %v", err)
	}

	if err := storage.InitS3FromEnv(); err != nil {
		log.Fatalf("Ошибка инициализации S3: %v", err)
	}

	if !storage.IsS3Enabled() {
		log.Fatal("S3 не настроен. Проверьте переменные окружения: S3_URL, S3_BUCKET_NAME, S3_ACCESS_KEY, S3_SECRET_KEY")
	}

	fmt.Println("=== Миграция файлов из uploads в S3 ===")
	fmt.Println()

	ctx := context.Background()
	baseDir := "uploads"

	var totalFiles, successFiles, skippedFiles, errorFiles int

	for folder, prefix := range foldersToMigrate {
		folderPath := filepath.Join(baseDir, folder)

		if _, err := os.Stat(folderPath); os.IsNotExist(err) {
			fmt.Printf("Папка %s не существует, пропускаем\n", folderPath)
			continue
		}

		fmt.Printf("Обработка папки: %s -> S3 prefix: %s\n", folderPath, prefix)

		entries, err := os.ReadDir(folderPath)
		if err != nil {
			fmt.Printf("Ошибка чтения папки %s: %v\n", folderPath, err)
			continue
		}

		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}

			filename := entry.Name()
			filePath := filepath.Join(folderPath, filename)
			totalFiles++

			if storage.ObjectExists(ctx, prefix, filename) {
				fmt.Printf("   [SKIP] %s - уже существует в S3\n", filename)
				skippedFiles++
				continue
			}

			file, err := os.Open(filePath)
			if err != nil {
				fmt.Printf("   [ERROR] %s - ошибка открытия: %v\n", filename, err)
				errorFiles++
				continue
			}

			info, err := file.Stat()
			if err != nil {
				file.Close()
				fmt.Printf("   [ERROR] %s - ошибка получения информации: %v\n", filename, err)
				errorFiles++
				continue
			}

			contentType := getContentType(filename)

			if err := storage.UploadObject(ctx, prefix, filename, file, info.Size(), contentType); err != nil {
				file.Close()
				fmt.Printf("   [ERROR] %s - ошибка загрузки в S3: %v\n", filename, err)
				errorFiles++
				continue
			}

			file.Close()
			fmt.Printf("   [OK] %s (%s, %.2f KB)\n", filename, contentType, float64(info.Size())/1024)
			successFiles++
		}

		fmt.Println()
	}

	fmt.Println("=== Результаты миграции ===")
	fmt.Printf("Всего файлов: %d\n", totalFiles)
	fmt.Printf("Успешно загружено: %d\n", successFiles)
	fmt.Printf("Пропущено (уже в S3): %d\n", skippedFiles)
	fmt.Printf("Ошибок: %d\n", errorFiles)
	fmt.Println()

	if errorFiles == 0 && successFiles > 0 {
		fmt.Println("Миграция завершена успешно!")
		fmt.Println()
		fmt.Println("Теперь вы можете удалить локальные файлы командами:")
		for folder := range foldersToMigrate {
			fmt.Printf("   rm -rf uploads/%s/*\n", folder)
		}
	} else if errorFiles > 0 {
		fmt.Println("Миграция завершена с ошибками. Проверьте логи выше.")
	}
}

func getContentType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))

	switch ext {
	case ".pdf":
		return "application/pdf"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".svg":
		return "image/svg+xml"
	case ".doc":
		return "application/msword"
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".xls":
		return "application/vnd.ms-excel"
	case ".xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	}

	mimeType := mime.TypeByExtension(ext)
	if mimeType != "" {
		return mimeType
	}

	return "application/octet-stream"
}
