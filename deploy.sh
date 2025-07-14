#!/bin/bash

echo "Pulling latest changes..."
git pull origin main || { echo "git pull failed"; exit 1; }

echo "Building backend..."
cd backend || exit
go build -o server cmd/main.go || { echo "Go build failed"; exit 1; }
sudo systemctl restart backend.service || { echo "Backend restart failed"; exit 1; }

echo "Building frontend..."
cd ../frontend || exit
npm run build || { echo "Frontend build failed"; exit 1; }
pm2 restart frontend || { echo "PM2 restart failed"; exit 1; }

echo "Deployment complete."

