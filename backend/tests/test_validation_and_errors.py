import io
import os
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_invalid_video_upload_extension():
    fake_file = io.BytesIO(b"This is not a video file.")
    response = client.post(
        "/api/detection/upload-video",
        files={"file": ("malicious.exe", fake_file, "application/octet-stream")}
    )
    assert response.status_code == 400
    assert "Invalid video format" in response.json()["detail"]

def test_valid_video_upload_analysis():
    video_path = "backend/data/sample_videos/test_surveillance.mp4"
    assert os.path.exists(video_path), "Sample video must exist"
    with open(video_path, "rb") as f:
        response = client.post(
            "/api/detection/upload-video",
            files={"file": ("test_surveillance.mp4", f, "video/mp4")}
        )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["total_frames"] == 120
    assert data["fps"] > 0
    assert "analyzed_frames" in data

def test_invalid_zone_polygon_less_than_3_points():
    invalid_zone = {
        "id": "zone_invalid",
        "name": "Line Zone",
        "polygon": [[0.1, 0.1], [0.9, 0.9]],
        "severity": "HIGH",
        "warning_buffer": 20,
        "enabled": True
    }
    response = client.post("/api/zones", json=invalid_zone)
    assert response.status_code == 400
    assert "at least 3 vertices" in response.json()["detail"]

def test_get_nonexistent_event_404():
    response = client.get("/api/events/nonexistent_id_999999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]

def test_acknowledge_nonexistent_event_404():
    response = client.post("/api/events/nonexistent_id_999999/acknowledge")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]

def test_settings_validation_and_update():
    get_resp = client.get("/api/settings")
    assert get_resp.status_code == 200
    cur_settings = get_resp.json()
    
    cur_settings["confidence_threshold"] = 0.55
    cur_settings["detection_interval_ms"] = 200
    put_resp = client.put("/api/settings", json=cur_settings)
    assert put_resp.status_code == 200
    updated = put_resp.json()
    assert updated["confidence_threshold"] == 0.55
    assert updated["detection_interval_ms"] == 200

def test_single_frame_invalid_base64():
    response = client.post(
        "/api/detection/frame",
        json={
            "image_base64": "not_valid_base64_content",
            "mode": "REAL"
        }
    )
    assert response.status_code == 400
