"""
gRPC сервер для генерации документов (актов выполненных работ)
"""
import grpc
from concurrent import futures
import logging
import os
import sys
import signal
import argparse

# Добавляем путь к сгенерированным proto файлам
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import document_generator_pb2
import document_generator_pb2_grpc
from document_generator_core import generate_document_from_data

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DocumentGeneratorServicer(document_generator_pb2_grpc.DocumentGeneratorServiceServicer):
    """Реализация gRPC сервиса генерации документов"""
    
    def GenerateDocument(self, request, context):
        """Генерация документа на основе переданных данных"""
        logger.info(f"Получен запрос на генерацию документа для адреса: {request.address}")
        
        try:
            # Преобразуем gRPC request в словарь для совместимости
            report_data = {
                "date": request.date,
                "address": request.address,
                "machine_name": request.machine_name,
                "machine_number": request.machine_number,
                "inventory_number": request.inventory_number,
                "classification": request.classification,
                "customClass": request.custom_class,
                "material": request.material,
                "recommendations": request.recommendations,
                "defects": request.defects,
                "additionalWorks": request.additional_works,
                "comments": request.comments,
                "checklistItems": [
                    {"task": item.task, "done": item.done}
                    for item in request.checklist_items
                ],
                "photos": list(request.photos),
                "firstName": request.first_name,
                "lastName": request.last_name,
            }
            
            result = generate_document_from_data(report_data)
            
            if result["success"]:
                response = document_generator_pb2.GenerateDocumentResponse(
                    success=True,
                    pdf_filename=result["pdf_filename"],
                    preview_filename=result.get("preview_filename", ""),
                    pdf_content=result.get("pdf_content", b""),
                    preview_content=result.get("preview_content", b""),
                    error_message=""
                )
                logger.info(f"Документ успешно сгенерирован: {result['pdf_filename']}")
            else:
                response = document_generator_pb2.GenerateDocumentResponse(
                    success=False,
                    pdf_filename="",
                    preview_filename="",
                    pdf_content=b"",
                    preview_content=b"",
                    error_message=result.get("error", "Неизвестная ошибка")
                )
                logger.error(f"Ошибка генерации документа: {result.get('error')}")
            
            return response
            
        except Exception as e:
            logger.exception(f"Исключение при генерации документа: {e}")
            return document_generator_pb2.GenerateDocumentResponse(
                success=False,
                pdf_filename="",
                preview_filename="",
                pdf_content=b"",
                preview_content=b"",
                error_message=str(e)
            )
    
    def HealthCheck(self, request, context):
        """Проверка здоровья сервиса"""
        return document_generator_pb2.HealthCheckResponse(
            healthy=True,
            message="Document Generator Service is running"
        )


def serve(port: int = 50051):
    """Запуск gRPC сервера"""
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    document_generator_pb2_grpc.add_DocumentGeneratorServiceServicer_to_server(
        DocumentGeneratorServicer(), server
    )
    
    server_address = f'[::]:{port}'
    server.add_insecure_port(server_address)
    server.start()
    
    logger.info(f"gRPC сервер документов запущен на порту {port}")
    
    # Обработка graceful shutdown
    def shutdown_handler(signum, frame):
        logger.info("Получен сигнал завершения, останавливаем сервер...")
        server.stop(grace=5)
    
    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)
    
    server.wait_for_termination()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Document Generator gRPC Server')
    parser.add_argument('--port', type=int, default=50051, help='Port to listen on')
    args = parser.parse_args()
    
    serve(args.port)
