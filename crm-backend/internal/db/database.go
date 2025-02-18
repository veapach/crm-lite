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
	ID         uint   `gorm:"primaryKey" json:"id"`
	FirstName  string `gorm:"not null" json:"firstName"`
	LastName   string `gorm:"not null" json:"lastName"`
	Department string `gorm:"not null" json:"department"`
	Phone      string `gorm:"uniqueIndex;not null" json:"phone"`
	Password   string `gorm:"not null" json:"password"`
}

type Report struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Filename string `gorm:"not null" json:"filename"`
	Date     string `gorm:"not null" json:"date"`
	Address  string `gorm:"not null" json:"address"`
}

func InitDB() {
	var err error
	DB, err = gorm.Open(sqlite.Open("database.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Ошибка при подключении к БД:", err)
	}

	DB.AutoMigrate(&Certificate{}, &User{}, &Report{})
}
