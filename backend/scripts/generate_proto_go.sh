#!/bin/bash

# Скрипт для генерации Go gRPC кода из proto файлов

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROTO_DIR="$SCRIPT_DIR/../proto"
OUTPUT_DIR="$SCRIPT_DIR/../internal/docgen"

echo "Создание директории для Go кода..."
mkdir -p "$OUTPUT_DIR"

echo "Генерация Go gRPC кода..."

protoc -I"$PROTO_DIR" \
    --go_out="$OUTPUT_DIR" \
    --go_opt=paths=source_relative \
    --go-grpc_out="$OUTPUT_DIR" \
    --go-grpc_opt=paths=source_relative \
    "$PROTO_DIR/document_generator.proto"

echo "Go gRPC код успешно сгенерирован в $OUTPUT_DIR"
