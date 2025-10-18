"""
Скрипт для генерации файла addressMapping.js из базы данных PostgreSQL
Извлекает технические адреса из таблицы addresses и создаёт структуру
для ручного заполнения реальных адресов и координат.
"""

import psycopg2
import os
import json
from datetime import datetime

# Параметры подключения к PostgreSQL
POSTGRES_DSN = os.environ.get('POSTGRES_DSN', 'postgresql://postgres:postgres@localhost:5432/crm_lite')

# Путь для сохранения файла
OUTPUT_FILE = os.path.abspath(os.path.join(
    os.path.dirname(__file__), 
    '..', '..', 
    'frontend', 'src', 'data', 
    'addressMapping.js'
))

def parse_postgres_dsn(dsn):
    """Парсинг DSN для получения параметров подключения"""
    # Формат: postgresql://user:password@host:port/database
    # или postgresql+psycopg2://user:password@host:port/database
    dsn = dsn.replace('postgresql+psycopg2://', '').replace('postgresql://', '')
    
    if '@' in dsn:
        auth, location = dsn.split('@')
        user, password = auth.split(':') if ':' in auth else (auth, '')
        host_port, database = location.split('/')
        host, port = host_port.split(':') if ':' in host_port else (host_port, '5432')
    else:
        user = 'postgres'
        password = 'postgres'
        host = 'localhost'
        port = '5432'
        database = 'crm_lite'
    
    return {
        'user': user,
        'password': password,
        'host': host,
        'port': port,
        'database': database
    }

def fetch_addresses_from_db():
    """Получение уникальных адресов из базы данных"""
    print("\n🔍 Подключение к базе данных PostgreSQL...")
    
    try:
        # Парсим DSN
        db_params = parse_postgres_dsn(POSTGRES_DSN)
        
        print(f"   📌 Хост: {db_params['host']}:{db_params['port']}")
        print(f"   📌 База данных: {db_params['database']}")
        print(f"   📌 Пользователь: {db_params['user']}")
        
        # Подключаемся к БД
        conn = psycopg2.connect(
            host=db_params['host'],
            port=db_params['port'],
            database=db_params['database'],
            user=db_params['user'],
            password=db_params['password']
        )
        
        cursor = conn.cursor()
        print("✅ Успешное подключение к базе данных!\n")
        
        # Получаем уникальные адреса
        print("📊 Извлекаю адреса из таблицы 'addresses'...")
        cursor.execute("""
            SELECT DISTINCT address 
            FROM addresses 
            WHERE address IS NOT NULL 
              AND address != ''
            ORDER BY address
        """)
        
        addresses = [row[0] for row in cursor.fetchall()]
        
        print(f"✅ Найдено {len(addresses)} уникальных адресов\n")
        
        cursor.close()
        conn.close()
        
        return addresses
        
    except psycopg2.Error as e:
        print(f"❌ Ошибка подключения к базе данных: {e}")
        return []
    except Exception as e:
        print(f"❌ Неожиданная ошибка: {e}")
        return []

def generate_mapping_file(addresses):
    """Генерация файла addressMapping.js"""
    if not addresses:
        print("⚠️  Нет адресов для обработки. Файл не будет создан.")
        return False
    
    print("📝 Генерирую файл addressMapping.js...\n")
    
    # Формируем содержимое файла
    content = []
    content.append("// Маппинг технических адресов на реальные адреса с координатами")
    content.append("// Формат: \"техническийАдрес\": { address: \"Человеческий адрес\", coordinates: [широта, долгота] }")
    content.append(f"// Автоматически сгенерировано: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    content.append(f"// Всего адресов: {len(addresses)}")
    content.append("")
    content.append("export const addressMapping = {")
    
    # Добавляем тестовый пример
    content.append('  // Пример заполнения (можете удалить после заполнения своих данных)')
    content.append('  "1234_Москва_ул_Ленина_1": {')
    content.append('    address: "Москва, ул. Ленина, д. 1",')
    content.append('    coordinates: [55.751244, 37.618423] // Координаты можно найти на Яндекс.Картах')
    content.append('  },')
    content.append('')
    content.append('  // ========== Адреса из базы данных (требуют заполнения) ==========')
    
    # Добавляем все адреса из БД
    for i, addr in enumerate(addresses):
        # Экранируем кавычки и специальные символы
        escaped_addr = addr.replace('\\', '\\\\').replace('"', '\\"')
        
        content.append(f'  "{escaped_addr}": {{')
        content.append(f'    address: "", // TODO: Укажите человекочитаемый адрес')
        content.append(f'    coordinates: [] // TODO: Укажите [широта, долгота]')
        
        # Добавляем запятую, если это не последний элемент
        if i < len(addresses) - 1:
            content.append('  },')
        else:
            content.append('  }')
        
        if (i + 1) % 10 == 0:
            content.append('')  # Пустая строка каждые 10 адресов для читаемости
    
    content.append("};")
    content.append("")
    content.append("// Функция для получения данных адреса по техническому адресу")
    content.append("export const getAddressData = (technicalAddress) => {")
    content.append("  if (!technicalAddress) return null;")
    content.append("  ")
    content.append("  // Попробуем найти точное совпадение")
    content.append("  if (addressMapping[technicalAddress]) {")
    content.append("    return addressMapping[technicalAddress];")
    content.append("  }")
    content.append("  ")
    content.append("  // Если не нашли, вернем null")
    content.append("  return null;")
    content.append("};")
    content.append("")
    
    # Записываем в файл
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write('\n'.join(content))
        
        print(f"✅ Файл успешно создан: {OUTPUT_FILE}")
        print(f"\n📍 Статистика:")
        print(f"   • Всего адресов: {len(addresses)}")
        print(f"   • Строк кода: {len(content)}")
        print(f"\n💡 Что делать дальше:")
        print(f"   1. Откройте файл: {OUTPUT_FILE}")
        print(f"   2. Для каждого адреса заполните:")
        print(f"      - address: реальный человекочитаемый адрес")
        print(f"      - coordinates: [широта, долгота]")
        print(f"   3. Координаты можно найти на Яндекс.Картах:")
        print(f"      ПКМ на карте → 'Что здесь?' → скопировать координаты")
        print(f"\n✨ Готово!\n")
        
        return True
        
    except Exception as e:
        print(f"❌ Ошибка при записи файла: {e}")
        return False

def main():
    """Главная функция"""
    print("=" * 70)
    print("🗺️  ГЕНЕРАТОР МАППИНГА АДРЕСОВ")
    print("=" * 70)
    
    # Получаем адреса из БД
    addresses = fetch_addresses_from_db()
    
    if not addresses:
        print("\n❌ Не удалось получить адреса из базы данных.")
        print("   Проверьте:")
        print("   • Подключение к PostgreSQL")
        print("   • Наличие таблицы 'addresses'")
        print("   • Наличие данных в столбце 'address'")
        return
    
    # Показываем примеры адресов
    print("📋 Примеры адресов из базы данных:")
    for i, addr in enumerate(addresses[:5], 1):
        print(f"   {i}. {addr}")
    
    if len(addresses) > 5:
        print(f"   ... и ещё {len(addresses) - 5} адресов\n")
    else:
        print()
    
    # Генерируем файл
    success = generate_mapping_file(addresses)
    
    if success:
        print("=" * 70)
        print("🎉 ПРОЦЕСС ЗАВЕРШЁН УСПЕШНО!")
        print("=" * 70)
    else:
        print("=" * 70)
        print("⚠️  ПРОЦЕСС ЗАВЕРШЁН С ОШИБКАМИ")
        print("=" * 70)

if __name__ == '__main__':
    main()
