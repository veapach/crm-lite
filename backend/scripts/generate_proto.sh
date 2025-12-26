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

# Исправляем импорт в сгенерированном файле
sed -i.bak 's/import document_generator_pb2/from . import document_generator_pb2/' "$OUTPUT_DIR/document_generator_pb2_grpc.py" 2>/dev/null || \
sed -i '' 's/import document_generator_pb2/import document_generator_pb2/' "$OUTPUT_DIR/document_generator_pb2_grpc.py"

echo "Python gRPC код успешно сгенерирован в $OUTPUT_DIR"
