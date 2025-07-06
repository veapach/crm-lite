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
	ID             uint   `gorm:"primaryKey" json:"id"`
	Filename       string `gorm:"not null"   json:"filename"`
	Date           string `gorm:"not null"   json:"date"`
	Address        string `gorm:"not null"   json:"address"`
	UserID         uint   `gorm:"not null"   json:"userId"`
	Classification string `gorm:"not null;default:'Не указано'" json:"classification"`
}

type Request struct {
	ID          uint    `gorm:"primaryKey"                                        json:"id"`
	Date        string  `gorm:"not null"                                          json:"date"`
	DepartTime  string  `gorm:"default:null"                                      json:"departTime"`
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

type Equipment struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Equipment string `gorm:"uniqueIndex;not null" json:"equipment"`
}

type Inventory struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	ObjectNumber string `gorm:"not null" json:"objectNumber"`                // Номер объекта (адрес)
	ZipName      string `gorm:"not null" json:"zipName"`                     // Наименование ЗИП
	Status       string `gorm:"not null;default:'не куплено'" json:"status"` // заказан/установлен
	Quantity     int    `gorm:"not null;default:1" json:"quantity"`
	EngineerID   uint   `gorm:"not null" json:"engineerId"`
	Engineer     User   `gorm:"foreignKey:EngineerID;constraint:OnDelete:CASCADE" json:"-"`
}

type TravelRecord struct {
	ID         uint    `gorm:"primaryKey"                                        json:"id"`
	Date       string  `gorm:"not null"                                          json:"date"`
	StartPoint string  `gorm:"not null"                                          json:"startPoint"`
	EndPoint   string  `gorm:"not null"                                          json:"endPoint"`
	Distance   float64 `gorm:"not null"                                         json:"distance"`
	UserID     uint    `gorm:"not null"                                         json:"userId"`
	User       User    `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE"    json:"-"`
}

func InitDB() {
	var err error
	DB, err = gorm.Open(sqlite.Open("database.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Ошибка при подключении к БД:", err)
	}

	DB.AutoMigrate(&File{}, &User{}, &Report{}, &Request{}, &Address{}, &AllowedPhone{}, &Equipment{}, &Inventory{}, &TravelRecord{})

	var count int64
	DB.Model(&AllowedPhone{}).Count(&count)
	if count == 0 {
		initialPhones := []string{"79197627770", "79267547359", "89163838980", "123"}
		for _, phone := range initialPhones {
			DB.Create(&AllowedPhone{Phone: phone})
		}
	}
}
