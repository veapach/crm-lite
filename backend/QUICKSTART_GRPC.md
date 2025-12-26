# Быстрый старт миграции на gRPC

## Что было сделано

✅ Создан Proto файл для gRPC сервиса генерации документов  
✅ Создан Python gRPC сервер (`grpc_server.py`)  
✅ Создан модуль `document_generator_core.py` с основной логикой  
✅ Добавлены gRPC зависимости в `go.mod` и `requirements.txt`  
✅ Создан Go gRPC клиент (`internal/docgen/client.go`)  
✅ Обновлен `handler.go` для использования gRPC с fallback  
✅ Обновлен `deploy.sh` для автоматического запуска gRPC сервиса  
✅ Создан systemd сервис `docgen-grpc.service`  

## Следующие шаги для запуска

### 1. Установить protoc компилятор

**macOS:**
```bash
brew install protobuf
```

**Linux:**
```bash
sudo apt-get install -y protobuf-compiler
```

### 2. Установить Go плагины для protoc

```bash
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
```

Убедитесь что `$GOPATH/bin` в вашем PATH:
```bash
export PATH="$PATH:$(go env GOPATH)/bin"
```

### 3. Сгенерировать Go proto файлы

```bash
cd backend/scripts
chmod +x generate_proto_go.sh
./generate_proto_go.sh
```

Это создаст файлы в `backend/internal/docgen/`:
- `document_generator.pb.go`
- `document_generator_grpc.pb.go`

### 4. Установить Python зависимости

```bash
cd backend/scripts
python3 -m venv venv
source venv/bin/activate  # или venv/Scripts/activate на Windows
pip install -r requirements.txt
```

### 5. Сгенерировать Python proto файлы

```bash
chmod +x generate_proto.sh
./generate_proto.sh
```

Это создаст файлы в `backend/scripts/`:
- `document_generator_pb2.py`
- `document_generator_pb2_grpc.py`

### 6. Запустить gRPC сервис (для тестирования)

```bash
cd backend/scripts
source venv/bin/activate
python3 grpc_server.py --port 50051
```

Оставьте это окно открытым.

### 7. Протестировать gRPC сервис

В новом терминале:
```bash
cd backend/scripts
source venv/bin/activate
python3 test_grpc.py
```

Если всё OK, увидите:
```
✓ Сервис работает: Document Generator Service is running
✓ Документ успешно сгенерирован
✅ Все тесты пройдены успешно!
```

### 8. Собрать и запустить Go бэкенд

```bash
cd backend
go mod tidy
go build -o server cmd/main.go
./server
```

### 9. Установить как systemd сервис (опционально, для продакшена)

```bash
# Отредактируйте пути в файле
sudo nano backend/docgen-grpc.service

# Скопируйте и запустите
sudo cp backend/docgen-grpc.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable docgen-grpc.service
sudo systemctl start docgen-grpc.service
sudo systemctl status docgen-grpc.service
```

## Переменные окружения

Создайте `.env` в `backend/`:
```env
DOCGEN_GRPC_ADDRESS=localhost:50051
```

## Проверка работы

1. **gRPC сервис работает?**
   ```bash
   netstat -tulpn | grep 50051
   # или
   lsof -i :50051
   ```

2. **Логи gRPC сервиса:**
   ```bash
   # Если через systemd:
   journalctl -u docgen-grpc.service -f
   
   # Если через nohup (deploy.sh):
   tail -f backend/logs/docgen_grpc.log
   ```

3. **Создать тестовый отчет через API**
   
   Используйте фронтенд или curl для создания отчета - система автоматически попробует gRPC, а при неудаче переключится на fallback.

## Архитектура

```
Frontend → Go Backend (port 8080) → gRPC (port 50051) → Python Service
                                    ↓ (если недоступен)
                                    Python exec (fallback)
```

## Troubleshooting

**Ошибка: `undefined: docgen.ChecklistItem`**
- Нужно сгенерировать Go proto файлы (шаг 3)

**Ошибка: `No module named 'document_generator_pb2'`**
- Нужно сгенерировать Python proto файлы (шаг 5)

**gRPC сервис не запускается**
- Проверьте что все Python зависимости установлены: `pip list | grep grpc`
- Проверьте что proto файлы сгенерированы: `ls -la backend/scripts/*pb2*`

**Go бэкенд не может подключиться**
- Проверьте что gRPC сервис запущен: `lsof -i :50051`
- Проверьте переменную окружения: `echo $DOCGEN_GRPC_ADDRESS`
- Система автоматически переключится на fallback

## Готово!

После выполнения всех шагов система будет работать через gRPC. При недоступности микросервиса автоматически включится fallback режим.

Подробная документация в `GRPC_MIGRATION.md`
