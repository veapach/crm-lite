package main

import (
	"backend/internal/db"
	"fmt"
	"log"
	"strings"
)

var equipment = []string{
	"Unox BAKERLUX SHOP XEFT-06EU-ETRV-DR ( с душ устройством  дренажом)",
	"Unox BAKERLUX SHOP. XEFT-06EU-ETRV ( без душ устройства и дренажа)",
	"WIESHEU Euromat 64 S Backofen",
	"MIWE Econ",
	"PRATICA FIT EXPRESS",
	"PRATICA COPA EXPRESS",
	"Merry Chef E2S",
	"Merry Chef X12D",
	"Unox XEPA-0523-EXLN (SPEED-X)",
}

func main() {
	db.InitDB()

	for _, equip := range equipment {
		newEquipment := db.Equipment{
			Equipment: strings.TrimSpace(equip),
		}

		var existingEquip db.Equipment
		if err := db.DB.Where("equipment = ?", newEquipment.Equipment).First(&existingEquip).Error; err == nil {
			fmt.Printf("Оборудование '%s' уже добавлено\n", newEquipment.Equipment)
			continue
		}

		if err := db.DB.Create(&newEquipment).Error; err != nil {
			log.Printf("Ошибка при добавлении оборудования '%s': %v\n", newEquipment.Equipment, err)
		} else {
			fmt.Printf("Оборудование '%s' успешно добавлено\n", newEquipment.Equipment)
		}
	}

	fmt.Println("Заполнение базы данных оборудованием завершено")
}
