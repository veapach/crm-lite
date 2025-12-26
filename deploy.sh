#!/bin/bash

echo "Pulling latest changes..."
git pull origin main || { echo "git pull failed"; exit 1; }

echo "Building backend..."
cd backend || exit

# Генерация Proto файлов
echo "Generating gRPC code..."
chmod +x scripts/generate_proto_go.sh
./scripts/generate_proto_go.sh || echo "Warning: Go proto generation failed, continuing..."

# Установка Python зависимостей и генерация Python proto
cd scripts || exit
if [ -d "venv" ]; then
    source venv/bin/activate || source venv/Scripts/activate
else
    python3 -m venv venv
    source venv/bin/activate || source venv/Scripts/activate
fi
pip install -r requirements.txt || echo "Warning: pip install failed"

chmod +x generate_proto.sh
./generate_proto.sh || echo "Warning: Python proto generation failed"
cd ..

# Сборка Go бэкенда
go mod tidy
go build -o server cmd/main.go || { echo "Go build failed"; exit 1; }

# Перезапуск gRPC сервиса документов
echo "Restarting document generator gRPC service..."
pkill -f "grpc_server.py" || true
nohup scripts/venv/bin/python3 scripts/grpc_server.py --port 50051 > logs/docgen_grpc.log 2>&1 &
echo "Document generator gRPC service started on port 50051"

# Перезапуск основного бэкенда
sudo systemctl restart backend.service || { echo "Backend restart failed"; exit 1; }

echo "Building frontend..."
cd ../frontend || exit
npm run build || { echo "Frontend build failed"; exit 1; }
pm2 restart frontend || { echo "PM2 restart failed"; exit 1; }

echo "Deployment complete."


