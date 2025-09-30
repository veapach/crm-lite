package db

import (
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

type File struct {
	ID       uint   `gorm:"primaryKey"  json:"id"`
	Filename string `gorm:"uniqueIndex" json:"filename"`
}

type User struct {
	ID               uint   `gorm:"primaryKey"           json:"id"`
	FirstName        string `gorm:"not null"             json:"firstName"`
	LastName         string `gorm:"not null"             json:"lastName"`
	Department       string `gorm:"not null"             json:"department"`
	HomeAddress      string `gorm:"default:null"         json:"homeAddress"`
	Phone            string `gorm:"uniqueIndex;not null" json:"phone"`
	Password         string `gorm:"not null"             json:"password"`
	TelegramChatID   *int64 `gorm:"default:null"         json:"telegramChatId"`
	TelegramNotifyOn bool   `gorm:"not null;default:true" json:"telegramNotifyOn"`
}

type Report struct {
	ID             uint   `gorm:"primaryKey" json:"id"`
	Filename       string `gorm:"not null"   json:"filename"`
	Date           string `gorm:"not null"   json:"date"`
	Address        string `gorm:"not null"   json:"address"`
	UserID         uint   `gorm:"not null"   json:"userId"`
	Classification string `gorm:"not null;default:'Не указано'" json:"classification"`
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

type EquipmentMemory struct {
	ID             uint   `gorm:"primaryKey" json:"id"`
	Address        string `gorm:"not null" json:"address"`
	Classification string `gorm:"not null" json:"classification"`
	MachineName    string `gorm:"not null" json:"machineName"`
	MachineNumber  string `gorm:"not null" json:"machineNumber"`
	Count          int    `gorm:"not null;default:1" json:"count"`
}

type ClientTicket struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	Date         string `gorm:"not null" json:"date"`
	FullName     string `gorm:"not null" json:"fullName"`
	Position     string `gorm:"not null" json:"position"`
	Contact      string `gorm:"default:null" json:"contact"`
	Address      string `gorm:"not null" json:"address"`
	Description  string `gorm:"not null" json:"description"`
	Status       string `gorm:"not null;default:'Не назначено'" json:"status"`
	EngineerID   *uint  `gorm:"default:null" json:"engineerId"`
	Engineer     *User  `gorm:"foreignKey:EngineerID;constraint:OnDelete:SET NULL" json:"-"`
	EngineerName string `gorm:"default:null" json:"engineerName"`
	Files        string `gorm:"type:text" json:"files"`
}

func InitDB() {
	var err error
	dsn := os.Getenv("POSTGRES_DSN")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=postgres dbname=crm_lite port=5432 sslmode=disable"
	}
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Ошибка при подключении к PostgreSQL:", err)
	}

	if err := DB.AutoMigrate(&File{}, &User{}, &Report{}, &Request{}, &Address{}, &AllowedPhone{}, &Equipment{}, &Inventory{}, &TravelRecord{}, &EquipmentMemory{}, &ClientTicket{}); err != nil {
		log.Fatal("Ошибка миграции схемы:", err)
	}

	var count int64
	DB.Model(&AllowedPhone{}).Count(&count)
	if count == 0 {
		initialPhones := []string{"79197627770", "79267547359", "89163838980", "123"}
		for _, phone := range initialPhones {
			DB.Create(&AllowedPhone{Phone: phone})
		}
	}
}
