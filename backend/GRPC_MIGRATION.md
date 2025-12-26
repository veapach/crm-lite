# Миграция на gRPC архитектуру

## Обзор изменений

Система генерации документов была переработана с прямого вызова Python скриптов через `exec.Command` на архитектуру микросервисов с использованием gRPC.

### Что изменилось:

1. **Python микросервис** - `grpc_server.py` теперь работает как отдельный gRPC сервис
2. **Go клиент** - бэкенд теперь общается с Python через gRPC вместо прямого вызова
3. **Fallback механизм** - если gRPC недоступен, система автоматически переключается на старый метод
4. **Улучшенная надёжность** - микросервис может перезапускаться независимо от основного бэкенда

## Установка и настройка

### 1. Установка зависимостей

#### Python зависимости:
```bash
cd backend/scripts
python3 -m venv venv
source venv/bin/activate  # или venv\Scripts\activate на Windows
pip install -r requirements.txt
```

#### Go зависимости:
```bash
cd backend
go mod tidy
```

### 2. Генерация Proto кода

#### Для Go:
```bash
cd backend/scripts
chmod +x generate_proto_go.sh
./generate_proto_go.sh
```

Требования: установленный `protoc` и плагины:
```bash
# Linux
sudo apt install protobuf-compiler
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# macOS
brew install protobuf
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
```

#### Для Python:
```bash
cd backend/scripts
chmod +x generate_proto.sh
./generate_proto.sh
```

### 3. Настройка переменных окружения

Создайте `.env` файл в `backend/`:
```bash
cd backend
cp .env.example .env
```

Отредактируйте `.env`:
```env
DOCGEN_GRPC_ADDRESS=localhost:50051
```

### 4. Запуск gRPC сервиса

#### Вручную (для разработки):
```bash
cd backend/scripts
source venv/bin/activate
python3 grpc_server.py --port 50051
```

#### Как системный сервис (для продакшена):

1. Отредактируйте `docgen-grpc.service`:
```bash
sudo nano /path/to/backend/docgen-grpc.service
```

Замените:
- `your_user` на вашего пользователя
- `/path/to/crm-lite` на реальный путь

2. Установите и запустите сервис:
```bash
sudo cp backend/docgen-grpc.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable docgen-grpc.service
sudo systemctl start docgen-grpc.service
```

3. Проверьте статус:
```bash
sudo systemctl status docgen-grpc.service
journalctl -u docgen-grpc.service -f
```

### 5. Запуск основного бэкенда

```bash
cd backend
go build -o server cmd/main.go
./server
```

## Архитектура

```
┌─────────────────┐
│   Go Backend    │
│  (Gin Server)   │
└────────┬────────┘
         │
         │ gRPC
         │ (port 50051)
         │
         ▼
┌─────────────────┐
│ Python Service  │
│ Document Gen    │
│  (grpc_server)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   File System   │
│ (uploads/...)   │
└─────────────────┘
```

## Fallback механизм

Если gRPC сервис недоступен, система автоматически использует старый метод прямого вызова Python скрипта. Это обеспечивает бесперебойную работу даже при сбоях микросервиса.

## Преимущества новой архитектуры

1. **Изоляция** - Python сервис работает независимо
2. **Масштабируемость** - легко запустить несколько экземпляров gRPC сервиса
3. **Мониторинг** - отдельные логи для каждого компонента
4. **Надёжность** - fallback механизм при сбоях
5. **Производительность** - переиспользование соединений gRPC

## Устранение неполадок

### gRPC сервис не запускается

1. Проверьте зависимости:
```bash
cd backend/scripts
source venv/bin/activate
pip list | grep grpc
```

2. Проверьте proto файлы сгенерированы:
```bash
ls -la backend/scripts/*pb2*
```

3. Проверьте логи:
```bash
journalctl -u docgen-grpc.service -n 50
```

### Go бэкенд не может подключиться к gRPC

1. Проверьте что сервис запущен:
```bash
sudo systemctl status docgen-grpc.service
```

2. Проверьте порт:
```bash
netstat -tulpn | grep 50051
```

3. Проверьте переменную окружения:
```bash
echo $DOCGEN_GRPC_ADDRESS
```

### Ошибки при генерации документов

Система автоматически переключится на fallback метод. Проверьте логи бэкенда:
```bash
journalctl -u backend.service -f
```

## Обновление на продакшене

Просто запустите обновлённый `deploy.sh`:
```bash
./deploy.sh
```

Скрипт автоматически:
1. Обновит код из git
2. Сгенерирует proto файлы
3. Пересоберёт Go бэкенд
4. Перезапустит gRPC сервис
5. Перезапустит основной бэкенд
6. Обновит фронтенд
