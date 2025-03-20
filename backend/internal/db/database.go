package db

import (
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

type File struct {
	ID       uint   `gorm:"primaryKey"  json:"id"`
	Filename string `gorm:"uniqueIndex" json:"filename"`
}

type User struct {
	ID         uint   `gorm:"primaryKey"           json:"id"`
	FirstName  string `gorm:"not null"             json:"firstName"`
	LastName   string `gorm:"not null"             json:"lastName"`
	Department string `gorm:"not null"             json:"department"`
	Phone      string `gorm:"uniqueIndex;not null" json:"phone"`
	Password   string `gorm:"not null"             json:"password"`
}

type Report struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Filename string `gorm:"not null"   json:"filename"`
	Date     string `gorm:"not null"   json:"date"`
	Address  string `gorm:"not null"   json:"address"`
	UserID   uint   `gorm:"not null"   json:"userId"`
}

type Request struct {
	ID          uint    `gorm:"primaryKey"                                        json:"id"`
	Date        string  `gorm:"not null"                                          json:"date"`
	Address     string  `gorm:"not null"                                          json:"address"`
	Status      string  `gorm:"not null;default:'В работе'"                       json:"status"`
	EngineerID  uint    `gorm:"not null"                                          json:"engineerId"`
	Engineer    User    `gorm:"foreignKey:EngineerID;constraint:OnDelete:CASCADE" json:"-"`
	Type        string  `gorm:"not null"                                          json:"type"`
	Description string  `gorm:"not null"                                          json:"description"`
	ReportID    *uint   `gorm:"default:null"                                      json:"reportId"`
	Report      *Report `gorm:"foreignKey:ReportID;constraint:OnDelete:SET NULL"  json:"-"`
}

type Address struct {
	ID      uint   `gorm:"primaryKey"           json:"id"`
	Address string `gorm:"uniqueIndex;not null" json:"address"`
}

type AllowedPhone struct {
	ID    uint   `gorm:"primaryKey"           json:"id"`
	Phone string `gorm:"uniqueIndex;not null" json:"phone"`
}

func InitDB() {
	var err error
	DB, err = gorm.Open(sqlite.Open("database.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Ошибка при подключении к БД:", err)
	}

	DB.AutoMigrate(&File{}, &User{}, &Report{}, &Request{}, &Address{}, &AllowedPhone{})

	var count int64
	DB.Model(&AllowedPhone{}).Count(&count)
	if count == 0 {
		initialPhones := []string{"79197627770", "79267547359", "89163838980", "123"}
		for _, phone := range initialPhones {
			DB.Create(&AllowedPhone{Phone: phone})
		}
	}
}
