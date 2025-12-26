#!/bin/bash

set -e  # Выходить при ошибках

echo "Pulling latest changes..."
git pull origin main || { echo "git pull failed"; exit 1; }

echo "Building backend..."
cd backend || exit

# Генерация Proto файлов для Go
echo "Generating Go gRPC code..."
export PATH="$PATH:$(go env GOPATH)/bin"
chmod +x scripts/generate_proto_go.sh
./scripts/generate_proto_go.sh || { echo "Error: Go proto generation failed"; exit 1; }

# Установка Python зависимостей и генерация Python proto
echo "Setting up Python environment..."
cd scripts || exit

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate || source venv/Scripts/activate
echo "Installing Python dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

echo "Generating Python gRPC code..."
chmod +x generate_proto.sh
./generate_proto.sh || { echo "Error: Python proto generation failed"; exit 1; }

# Исправляем импорт в сгенерированном файле
if [ -f "document_generator_pb2_grpc.py" ]; then
    sed -i 's/from \. import document_generator_pb2/import document_generator_pb2/' document_generator_pb2_grpc.py 2>/dev/null || \
    sed -i '' 's/from \. import document_generator_pb2/import document_generator_pb2/' document_generator_pb2_grpc.py
fi

deactivate
cd ..

# Сборка Go бэкенда
go mod tidy
go build -o server cmd/main.go || { echo "Go build failed"; exit 1; }

# Перезапуск gRPC сервиса документов
echo "Restarting document generator gRPC service..."

# Останавливаем старый процесс
pkill -f "grpc_server.py" || true
sleep 2

# Проверяем наличие systemd сервиса
if systemctl list-unit-files | grep -q "docgen-grpc.service"; then
    echo "Using systemd service..."
    sudo systemctl restart docgen-grpc.service
    sudo systemctl status docgen-grpc.service --no-pager || true
else
    echo "Starting gRPC service manually..."
    mkdir -p logs
    nohup scripts/venv/bin/python3 scripts/grpc_server.py --port 50051 > logs/docgen_grpc.log 2>&1 &
    sleep 2
    if lsof -i :50051 > /dev/null 2>&1; then
        echo "✓ Document generator gRPC service started on port 50051"
    else
        echo "✗ Failed to start gRPC service, check logs/docgen_grpc.log"
    fi
fi

# Перезапуск основного бэкенда
sudo systemctl restart backend.service || { echo "Backend restart failed"; exit 1; }

echo "Building frontend..."
cd ../frontend || exit
npm run build || { echo "Frontend build failed"; exit 1; }
pm2 restart frontend || { echo "PM2 restart failed"; exit 1; }

echo "Deployment complete."


