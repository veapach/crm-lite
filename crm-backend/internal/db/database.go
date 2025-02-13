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

type User struct {
	FirstName  string `json:"firstName"`
	LastName   string `json:"lastName"`
	Department string `json:"department"`
	Phone      string `json:"phone"`
	Password   string `json:"password"`
}

func InitDB() {
	var err error
	DB, err = gorm.Open(sqlite.Open("database.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Ошибка при подключении к БД:", err)
	}

	DB.AutoMigrate(&Certificate{})
	DB.AutoMigrate(&User{})
}
