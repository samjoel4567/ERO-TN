"""Persistent incident documents and atomic resource reservation transactions."""
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .schemas import CardiacIncident

DEFAULT_DB = Path(__file__).resolve().parents[2] / ".simulation" / "cardiac.sqlite3"


class IncidentStore:
    def __init__(self, path=None):
        self.path = str(path or os.getenv("CARDIAC_DB_PATH", DEFAULT_DB))

    @contextmanager
    def transaction(self):
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path, timeout=30)
        try:
            connection.execute("CREATE TABLE IF NOT EXISTS cardiac_incidents (id TEXT PRIMARY KEY, document TEXT NOT NULL)")
            connection.execute("BEGIN IMMEDIATE")
            yield IncidentRepository(connection)
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()


class IncidentRepository:
    def __init__(self, connection):
        self.connection = connection

    def get(self, incident_id):
        row = self.connection.execute("SELECT document FROM cardiac_incidents WHERE id=?", (incident_id,)).fetchone()
        return CardiacIncident.model_validate_json(row[0]) if row else None

    def all(self):
        rows = self.connection.execute("SELECT document FROM cardiac_incidents ORDER BY rowid DESC").fetchall()
        return [CardiacIncident.model_validate_json(row[0]) for row in rows]

    def save(self, incident):
        self.connection.execute("INSERT INTO cardiac_incidents(id,document) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document",
                                (incident.id, incident.model_dump_json()))
