import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import db
from app.models import ZoneModel, EventModel

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "model_loaded" in data
    assert "database_connected" in data
    assert data["database_connected"] is True

def test_zones_crud():
    # 1. Get zones
    resp = client.get("/api/zones")
    assert resp.status_code == 200
    zones = resp.json()
    assert isinstance(zones, list)
    
    # 2. Create a new zone
    new_zone = {
        "id": "zone_test_automated",
        "name": "Automated Test Corridor",
        "polygon": [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
        "severity": "CRITICAL",
        "warning_buffer": 45,
        "enabled": True,
        "color": "#EF4444"
    }
    create_resp = client.post("/api/zones", json=new_zone)
    assert create_resp.status_code == 200
    assert create_resp.json()["name"] == "Automated Test Corridor"
    
    # 3. Update zone
    new_zone["name"] = "Automated Test Corridor (Updated)"
    update_resp = client.put(f"/api/zones/{new_zone['id']}", json=new_zone)
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Automated Test Corridor (Updated)"
    
    # 4. Delete zone
    del_resp = client.delete(f"/api/zones/{new_zone['id']}")
    assert del_resp.status_code == 200

def test_events_flow():
    # 1. Seed demo events
    seed_resp = client.post("/api/events/seed-demo?count=4")
    assert seed_resp.status_code == 200
    
    # 2. Get list of events
    list_resp = client.get("/api/events?limit=10")
    assert list_resp.status_code == 200
    events = list_resp.json()
    assert len(events) >= 1
    
    target_event = events[0]
    target_id = target_event["event_id"]
    
    # 3. Get single event
    get_resp = client.get(f"/api/events/{target_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["event_id"] == target_id
    
    # 4. Acknowledge event
    ack_resp = client.post(f"/api/events/{target_id}/acknowledge")
    assert ack_resp.status_code == 200
    assert ack_resp.json()["acknowledged"] is True
    assert ack_resp.json()["acknowledged_at"] is not None
    
    # 5. Export CSV
    csv_resp = client.get("/api/events/export/csv")
    assert csv_resp.status_code == 200
    assert "Event ID" in csv_resp.text
    assert "Severity" in csv_resp.text
