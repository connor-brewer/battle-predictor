"""Database connection helper for Cloud SQL (MySQL).

Reads connection details from environment variables (loaded from .env when
available).  FastAPI routes call ``get_db_connection()`` per-request and
close the connection in a finally block.

Required env vars
-----------------
DB_HOST  – host or host:port  (default ``localhost:3306``)
DB_USER  – MySQL user
DB_PASS  – MySQL password
DB_NAME  – schema name         (default ``PokemonDB``)
"""

import os

import mysql.connector
from dotenv import load_dotenv

load_dotenv()


def get_db_connection():
    """Return a fresh ``mysql.connector`` connection."""
    host_port = os.getenv("DB_HOST", "localhost:3306")
    if ":" in host_port:
        host, port_str = host_port.split(":", 1)
        port = int(port_str)
    else:
        host = host_port
        port = 3306

    return mysql.connector.connect(
        host=host,
        port=port,
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASS"),
        database=os.getenv("DB_NAME", "PokemonDB"),
    )


if __name__ == "__main__":
    # Quick self-test when run directly — never at import time.
    try:
        conn = get_db_connection()
        print("Database connection successful!")
        cur = conn.cursor()
        cur.execute("SELECT * FROM Pokemon LIMIT 1;")
        print("Sample data:", cur.fetchall())
        cur.close()
        conn.close()
    except mysql.connector.Error as err:
        print(f"Database connection failed: {err}")
