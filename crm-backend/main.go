package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var db *gorm.DB

func initDB(){
	var err error
	db, err = gorm.Open(sqlite.Open("certificates.db"), &gorm.Config{})
	if err != nil{
		log.Fatal("Ошибка при подключении к БД:", err)
	}
	db.AutoMigrate(&Certificate{})
	os.MkdirAll("uploads", os.ModePerm)
}