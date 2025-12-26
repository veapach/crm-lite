#!/bin/bash

# Скрипт для генерации Python gRPC кода из proto файлов

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROTO_DIR="$SCRIPT_DIR/../proto"
OUTPUT_DIR="$SCRIPT_DIR"

echo "Генерация Python gRPC кода..."

python3 -m grpc_tools.protoc \
    -I"$PROTO_DIR" \
    --python_out="$OUTPUT_DIR" \
    --grpc_python_out="$OUTPUT_DIR" \
    "$PROTO_DIR/document_generator.proto"

if [ $? -ne 0 ]; then
    echo "✗ Ошибка при генерации Python gRPC кода"
    exit 1
fi

# Исправляем импорт в сгенерированном файле (убираем относительный импорт)
if [ -f "$OUTPUT_DIR/document_generator_pb2_grpc.py" ]; then
    echo "Исправление импортов..."
    sed -i.bak 's/from \. import document_generator_pb2/import document_generator_pb2/' "$OUTPUT_DIR/document_generator_pb2_grpc.py" 2>/dev/null || \
    sed -i '' 's/from \. import document_generator_pb2/import document_generator_pb2/' "$OUTPUT_DIR/document_generator_pb2_grpc.py"
    rm -f "$OUTPUT_DIR/document_generator_pb2_grpc.py.bak"
fi

echo "✓ Python gRPC код успешно сгенерирован в $OUTPUT_DIR"
