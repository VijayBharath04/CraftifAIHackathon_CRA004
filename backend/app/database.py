import sqlite3
import json
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from .config import settings
from .models import EventModel, ZoneModel, AppSettingsModel

class Database:
    def __init__(self, db_path: str = settings.DB_PATH):
        self.db_path = db_path
        self._init_db()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        with self.get_connection() as conn:
            cursor = conn.cursor()
            # Events Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS events (
                event_id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                zone TEXT NOT NULL,
                zone_id TEXT,
                severity TEXT NOT NULL,
                person_count INTEGER NOT NULL,
                confidence REAL NOT NULL,
                timestamp TEXT NOT NULL,
                snapshot_path TEXT,
                snapshot_base64 TEXT,
                acknowledged INTEGER DEFAULT 0,
                acknowledged_at TEXT,
                is_demo INTEGER DEFAULT 0,
                details TEXT
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_ts ON events(timestamp DESC)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_ack ON events(acknowledged)")

            # Zones Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS zones (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                polygon TEXT NOT NULL,
                severity TEXT NOT NULL,
                warning_buffer INTEGER DEFAULT 35,
                enabled INTEGER DEFAULT 1,
                color TEXT DEFAULT '#EF4444'
            )
            """)

            # Settings Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """)

            conn.commit()

            # Seed default zones if empty
            cursor.execute("SELECT COUNT(*) as cnt FROM zones")
            if cursor.fetchone()["cnt"] == 0:
                default_zone = ZoneModel(
                    id="zone_vault_perimeter",
                    name="Perimeter Restricted Zone",
                    polygon=[
                        [0.20, 0.30],
                        [0.80, 0.30],
                        [0.80, 0.85],
                        [0.20, 0.85]
                    ],
                    severity="HIGH",
                    warning_buffer=40,
                    enabled=True,
                    color="#EF4444"
                )
                self.save_zone(default_zone)

    # Zone CRUD
    def get_zones(self) -> List[ZoneModel]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM zones")
            rows = cursor.fetchall()
            zones = []
            for r in rows:
                poly = json.loads(r["polygon"])
                zones.append(ZoneModel(
                    id=r["id"],
                    name=r["name"],
                    polygon=poly,
                    severity=r["severity"],
                    warning_buffer=r["warning_buffer"],
                    enabled=bool(r["enabled"]),
                    color=r["color"]
                ))
            return zones

    def save_zone(self, zone: ZoneModel) -> ZoneModel:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO zones (id, name, polygon, severity, warning_buffer, enabled, color)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                polygon=excluded.polygon,
                severity=excluded.severity,
                warning_buffer=excluded.warning_buffer,
                enabled=excluded.enabled,
                color=excluded.color
            """, (
                zone.id,
                zone.name,
                json.dumps(zone.polygon),
                zone.severity,
                zone.warning_buffer,
                1 if zone.enabled else 0,
                zone.color
            ))
            conn.commit()
            return zone

    def delete_zone(self, zone_id: str) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM zones WHERE id = ?", (zone_id,))
            conn.commit()
            return cursor.rowcount > 0

    # Event CRUD
    def save_event(self, event: EventModel) -> EventModel:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO events (
                event_id, event_type, zone, zone_id, severity,
                person_count, confidence, timestamp, snapshot_path,
                snapshot_base64, acknowledged, acknowledged_at, is_demo, details
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                event.event_id,
                event.event_type,
                event.zone,
                event.zone_id,
                event.severity,
                event.person_count,
                event.confidence,
                event.timestamp,
                event.snapshot_path,
                event.snapshot_base64,
                1 if event.acknowledged else 0,
                event.acknowledged_at,
                1 if event.is_demo else 0,
                json.dumps(event.details or {})
            ))
            conn.commit()
            return event

    def get_events(
        self,
        limit: int = 50,
        offset: int = 0,
        severity: Optional[str] = None,
        zone: Optional[str] = None,
        acknowledged: Optional[bool] = None,
        is_demo: Optional[bool] = None,
        search: Optional[str] = None
    ) -> List[EventModel]:
        query = "SELECT * FROM events WHERE 1=1"
        params: List[Any] = []

        if severity:
            query += " AND severity = ?"
            params.append(severity)
        if zone:
            query += " AND zone = ?"
            params.append(zone)
        if acknowledged is not None:
            query += " AND acknowledged = ?"
            params.append(1 if acknowledged else 0)
        if is_demo is not None:
            query += " AND is_demo = ?"
            params.append(1 if is_demo else 0)
        if search:
            query += " AND (zone LIKE ? OR event_type LIKE ? OR event_id LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            events = []
            for r in rows:
                events.append(EventModel(
                    event_id=r["event_id"],
                    event_type=r["event_type"],
                    zone=r["zone"],
                    zone_id=r["zone_id"],
                    severity=r["severity"],
                    person_count=r["person_count"],
                    confidence=r["confidence"],
                    timestamp=r["timestamp"],
                    snapshot_path=r["snapshot_path"],
                    snapshot_base64=r["snapshot_base64"],
                    acknowledged=bool(r["acknowledged"]),
                    acknowledged_at=r["acknowledged_at"],
                    is_demo=bool(r["is_demo"]),
                    details=json.loads(r["details"] or "{}")
                ))
            return events

    def get_event_by_id(self, event_id: str) -> Optional[EventModel]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM events WHERE event_id = ?", (event_id,))
            r = cursor.fetchone()
            if not r:
                return None
            return EventModel(
                event_id=r["event_id"],
                event_type=r["event_type"],
                zone=r["zone"],
                zone_id=r["zone_id"],
                severity=r["severity"],
                person_count=r["person_count"],
                confidence=r["confidence"],
                timestamp=r["timestamp"],
                snapshot_path=r["snapshot_path"],
                snapshot_base64=r["snapshot_base64"],
                acknowledged=bool(r["acknowledged"]),
                acknowledged_at=r["acknowledged_at"],
                is_demo=bool(r["is_demo"]),
                details=json.loads(r["details"] or "{}")
            )

    def acknowledge_event(self, event_id: str) -> Optional[EventModel]:
        now_iso = datetime.now(timezone.utc).isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE events 
            SET acknowledged = 1, acknowledged_at = ?
            WHERE event_id = ?
            """, (now_iso, event_id))
            conn.commit()
            if cursor.rowcount == 0:
                return None
        return self.get_event_by_id(event_id)

    def clear_events(self, keep_unacknowledged: bool = False) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if keep_unacknowledged:
                cursor.execute("DELETE FROM events WHERE acknowledged = 1")
            else:
                cursor.execute("DELETE FROM events")
            conn.commit()
            return cursor.rowcount

    def get_event_stats(self) -> Dict[str, Any]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as total FROM events")
            total = cursor.fetchone()["total"]
            cursor.execute("SELECT COUNT(*) as unack FROM events WHERE acknowledged = 0")
            unack = cursor.fetchone()["unack"]
            cursor.execute("SELECT severity, COUNT(*) as cnt FROM events GROUP BY severity")
            by_severity = {r["severity"]: r["cnt"] for r in cursor.fetchall()}
            cursor.execute("SELECT zone, COUNT(*) as cnt FROM events GROUP BY zone ORDER BY cnt DESC LIMIT 5")
            by_zone = {r["zone"]: r["cnt"] for r in cursor.fetchall()}
            return {
                "total_events": total,
                "unacknowledged_events": unack,
                "by_severity": by_severity,
                "by_zone": by_zone
            }

    # Settings CRUD
    def get_settings(self) -> AppSettingsModel:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM app_settings")
            rows = cursor.fetchall()
            kv = {r["key"]: r["value"] for r in rows}
            model_dict = {}
            for field in AppSettingsModel.model_fields.keys():
                if field in kv:
                    val = kv[field]
                    if field in ("confidence_threshold",):
                        model_dict[field] = float(val)
                    elif field in ("detection_interval_ms", "warning_buffer_px"):
                        model_dict[field] = int(val)
                    elif field in ("snapshot_enabled", "alert_sound_enabled"):
                        model_dict[field] = val.lower() == "true"
                    else:
                        model_dict[field] = val
            return AppSettingsModel(**model_dict)

    def save_settings(self, settings_model: AppSettingsModel) -> AppSettingsModel:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            for key, val in settings_model.model_dump().items():
                cursor.execute("""
                INSERT INTO app_settings (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """, (key, str(val)))
            conn.commit()
        return settings_model

db = Database()
