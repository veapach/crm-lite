package docgen

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// Client - клиент для взаимодействия с сервисом генерации документов
type Client struct {
	conn   *grpc.ClientConn
	client DocumentGeneratorServiceClient
}

// NewClient создает новый клиент для gRPC сервиса генерации документов
func NewClient(address string) (*Client, error) {
	// Увеличиваем лимит размера сообщений до 50MB
	maxMsgSize := 50 * 1024 * 1024
	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithDefaultCallOptions(
			grpc.MaxCallRecvMsgSize(maxMsgSize),
			grpc.MaxCallSendMsgSize(maxMsgSize),
		),
	}

	conn, err := grpc.Dial(address, opts...)
	if err != nil {
		return nil, fmt.Errorf("не удалось подключиться к сервису генерации документов: %v", err)
	}

	client := NewDocumentGeneratorServiceClient(conn)

	return &Client{
		conn:   conn,
		client: client,
	}, nil
}

// Close закрывает соединение с gRPC сервисом
func (c *Client) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

// GenerateDocument вызывает gRPC метод для генерации документа
func (c *Client) GenerateDocument(ctx context.Context, req *GenerateDocumentRequest) (*GenerateDocumentResponse, error) {
	return c.client.GenerateDocument(ctx, req)
}

// RegeneratePreview вызывает gRPC метод для регенерации превью из PDF
func (c *Client) RegeneratePreview(ctx context.Context, req *RegeneratePreviewRequest) (*RegeneratePreviewResponse, error) {
	return c.client.RegeneratePreview(ctx, req)
}

// HealthCheck проверяет доступность сервиса
func (c *Client) HealthCheck(ctx context.Context) (bool, error) {
	resp, err := c.client.HealthCheck(ctx, &HealthCheckRequest{})
	if err != nil {
		return false, err
	}
	return resp.Healthy, nil
}

// GetClientFromEnv создает клиента на основе переменных окружения
func GetClientFromEnv() (*Client, error) {
	address := os.Getenv("DOCGEN_GRPC_ADDRESS")
	if address == "" {
		address = "localhost:50051" // значение по умолчанию
	}

	client, err := NewClient(address)
	if err != nil {
		return nil, err
	}

	// Проверяем доступность сервиса
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	healthy, err := client.HealthCheck(ctx)
	if err != nil {
		log.Printf("Предупреждение: сервис генерации документов недоступен: %v", err)
		// Не возвращаем ошибку, чтобы система могла работать без микросервиса
		return client, nil
	}

	if !healthy {
		log.Printf("Предупреждение: сервис генерации документов не здоров")
	}

	return client, nil
}
