#!/usr/bin/env python3
"""
Тестовый скрипт для проверки работы gRPC сервиса генерации документов
"""
import grpc
import sys
import os

# Добавляем путь к сгенерированным proto файлам
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import document_generator_pb2
import document_generator_pb2_grpc


def test_health_check(address="localhost:50051"):
    """Проверка доступности сервиса"""
    print(f"Подключение к {address}...")
    
    try:
        channel = grpc.insecure_channel(address)
        stub = document_generator_pb2_grpc.DocumentGeneratorServiceStub(channel)
        
        request = document_generator_pb2.HealthCheckRequest()
        response = stub.HealthCheck(request, timeout=5)
        
        if response.healthy:
            print(f"✓ Сервис работает: {response.message}")
            return True
        else:
            print(f"✗ Сервис нездоров: {response.message}")
            return False
            
    except grpc.RpcError as e:
        print(f"✗ Ошибка подключения: {e.code()} - {e.details()}")
        return False
    except Exception as e:
        print(f"✗ Неожиданная ошибка: {e}")
        return False
    finally:
        channel.close()


def test_document_generation(address="localhost:50051"):
    """Тест генерации документа"""
    print(f"\nТестирование генерации документа...")
    
    try:
        channel = grpc.insecure_channel(address)
        stub = document_generator_pb2_grpc.DocumentGeneratorServiceStub(channel)
        
        # Создаём тестовый запрос
        request = document_generator_pb2.GenerateDocumentRequest(
            date="2025-12-26 10:00",
            address="Тестовый адрес, д. 1",
            machine_name="Тестовое оборудование",
            machine_number="TEST-001",
            inventory_number="INV-001",
            classification="ТО",
            material="Тестовые материалы",
            recommendations="Тестовые рекомендации",
            first_name="Иван",
            last_name="Иванов",
            checklist_items=[
                document_generator_pb2.ChecklistItem(task="Проверка работы", done=True),
                document_generator_pb2.ChecklistItem(task="Очистка фильтров", done=True),
            ],
            photos=[]
        )
        
        print("Отправка запроса на генерацию...")
        response = stub.GenerateDocument(request, timeout=30)
        
        if response.success:
            print(f"✓ Документ успешно сгенерирован:")
            print(f"  PDF: {response.pdf_filename}")
            print(f"  Превью: {response.preview_filename}")
            print(f"  Размер PDF: {len(response.pdf_content)} байт")
            print(f"  Размер превью: {len(response.preview_content)} байт")
            return True
        else:
            print(f"✗ Ошибка генерации: {response.error_message}")
            return False
            
    except grpc.RpcError as e:
        print(f"✗ Ошибка gRPC: {e.code()} - {e.details()}")
        return False
    except Exception as e:
        print(f"✗ Неожиданная ошибка: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        channel.close()


def main():
    """Главная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Тестирование gRPC сервиса')
    parser.add_argument('--address', default='localhost:50051', help='Адрес gRPC сервиса')
    parser.add_argument('--skip-generation', action='store_true', help='Пропустить тест генерации')
    args = parser.parse_args()
    
    print("=" * 60)
    print("Тестирование gRPC сервиса генерации документов")
    print("=" * 60)
    
    # Тест 1: Health Check
    health_ok = test_health_check(args.address)
    
    if not health_ok:
        print("\n❌ Сервис недоступен. Проверьте что grpc_server.py запущен.")
        sys.exit(1)
    
    # Тест 2: Генерация документа (опционально)
    if not args.skip_generation:
        gen_ok = test_document_generation(args.address)
        
        if not gen_ok:
            print("\n⚠️  Генерация документа не удалась")
            sys.exit(1)
    
    print("\n" + "=" * 60)
    print("✅ Все тесты пройдены успешно!")
    print("=" * 60)


if __name__ == '__main__':
    main()
