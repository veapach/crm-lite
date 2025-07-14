import pandas as pd
from sqlalchemy import create_engine
import sqlite3
import os

# Параметры подключения
SQLITE_DB = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'database.db'))
POSTGRES_DSN = os.environ.get('POSTGRES_DSN', 'postgresql+psycopg2://postgres:postgres@localhost:5432/crm_lite')

# Таблицы для переноса (должны совпадать с моделями GORM)
tables = [
    'files',
    'users',
    'reports',
    'requests',
    'addresses',
    'allowed_phones',
    'equipment',
    'inventories',
    'travel_records',
    'equipment_memories',
]

def migrate():
    # Подключение к SQLite
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    # Подключение к Postgres
    pg_engine = create_engine(POSTGRES_DSN)

    # Очистка всех таблиц в Postgres перед переносом
    with pg_engine.connect() as conn:
        trans = conn.begin()
        from sqlalchemy import text
        try:
            for table in tables:
                print(f"TRUNCATE TABLE {table} CASCADE ...")
                conn.execute(text(f'TRUNCATE TABLE {table} RESTART IDENTITY CASCADE;'))
            trans.commit()
            print("Все таблицы очищены.")
        except Exception as e:
            trans.rollback()
            print(f"Ошибка при очистке таблиц: {e}")
            return

    for table in tables:
        print(f"Переносим таблицу: {table}")
        df = pd.read_sql_query(f'SELECT * FROM {table}', sqlite_conn)
        if not df.empty:
            try:
                df.to_sql(table, pg_engine, if_exists='append', index=False)
                print(f"Перенесено {len(df)} строк в Postgres.")
            except Exception as e:
                print(f"Ошибка при переносе таблицы {table}: {e}")
                print(df.head())
        else:
            print(f"Таблица {table} пуста, пропускаем.")

    sqlite_conn.close()
    print("Перенос завершен!")

if __name__ == '__main__':
    migrate()
