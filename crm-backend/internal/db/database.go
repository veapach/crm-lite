package db

import (
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

type Certificate struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Filename string `gorm:"uniqueIndex" json:"filename"`
}

func InitDB() {
	var err error
	DB, err = gorm.Open(sqlite.Open("certificates.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Ошибка при подключении к БД:", err)
	}

	DB.AutoMigrate(&Certificate{})
}
