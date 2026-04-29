from __future__ import annotations

import asyncio
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from config.settings import get_settings

client: Optional[AsyncIOMotorClient] = None
database: Optional[AsyncIOMotorDatabase] = None
connection_state = "disconnected"
last_connection_error: str | None = None
_connect_lock: asyncio.Lock | None = None


def _get_connect_lock() -> asyncio.Lock:
    global _connect_lock

    if _connect_lock is None:
        _connect_lock = asyncio.Lock()
    return _connect_lock


async def connect_to_mongo() -> bool:
    global client, database, connection_state, last_connection_error

    if client is not None and database is not None:
        connection_state = "connected"
        last_connection_error = None
        return True

    async with _get_connect_lock():
        if client is not None and database is not None:
            connection_state = "connected"
            last_connection_error = None
            return True

        connection_state = "connecting"
        last_connection_error = None

        settings = get_settings()
        pending_client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
        try:
            await pending_client.admin.command("ping")
        except Exception as exc:
            pending_client.close()
            client = None
            database = None
            connection_state = "disconnected"
            last_connection_error = str(exc)
            return False

        client = pending_client
        database = client[settings.mongodb_db_name]
        connection_state = "connected"
        last_connection_error = None
        return True


async def close_mongo_connection() -> None:
    global client, database, connection_state, last_connection_error

    if client is not None:
        client.close()

    client = None
    database = None
    connection_state = "disconnected"
    last_connection_error = None


def get_database() -> AsyncIOMotorDatabase:
    if database is None:
        raise RuntimeError("MongoDB connection has not been initialized")
    return database


def get_database_status() -> dict[str, str | bool | None]:
    return {
        "connected": database is not None,
        "state": connection_state,
        "error": last_connection_error,
    }
