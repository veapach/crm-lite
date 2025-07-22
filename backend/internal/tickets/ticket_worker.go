package tickets

import (
	"backend/internal/db"
	"log"

	"encoding/json"

	"github.com/streadway/amqp"
)

func StartTicketWorker(amqpURL string) {
	conn, err := amqp.Dial(amqpURL)
	if err != nil {
		log.Fatalf("RabbitMQ connection error: %v", err)
	}
	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("RabbitMQ channel error: %v", err)
	}
	q, err := ch.QueueDeclare("tickets", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Queue declaration error: %v", err)
	}

	msgs, err := ch.Consume(q.Name, "", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Queue consumption error: %v", err)
	}

	go func() {
		for msg := range msgs {
			var ticket db.ClientTicket
			if err := json.Unmarshal(msg.Body, &ticket); err == nil {
				if err := db.DB.Create(&ticket).Error; err != nil {
					log.Printf("Ошибка сохранения тикета: %v", err)
				}
			}
		}
	}()
	log.Println("Ticket worker started")
}
