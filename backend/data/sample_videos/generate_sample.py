import cv2
import numpy as np
import os

def create_sample_video():
    os.makedirs("backend/data/sample_videos", exist_ok=True)
    out_path = "backend/data/sample_videos/test_surveillance.mp4"
    width, height = 640, 480
    fps = 20
    duration_s = 6
    total_frames = fps * duration_s

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(out_path, fourcc, fps, (width, height))

    for f in range(total_frames):
        # Industrial security corridor background
        frame = np.full((height, width, 3), (35, 30, 25), dtype=np.uint8)
        
        # Grid lines and corridor perspective
        cv2.line(frame, (100, 480), (250, 150), (60, 55, 50), 2)
        cv2.line(frame, (540, 480), (390, 150), (60, 55, 50), 2)
        cv2.line(frame, (250, 150), (390, 150), (70, 65, 60), 2)
        
        # Restricted Zone markings on floor
        pts = np.array([[180, 280], [460, 280], [510, 430], [130, 430]], np.int32)
        cv2.polylines(frame, [pts], isClosed=True, color=(0, 0, 200), thickness=2)
        cv2.putText(frame, "RESTRICTED AREA", (200, 310), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 220), 2)

        # Draw a walking human figure (head, torso, legs)
        # Person moves from left (outside) into center (restricted zone) and then to right
        t = f / total_frames
        px = int(80 + t * 480)
        py = int(220 + math.sin(t * 3.1415) * 40)
        
        # Head
        cv2.circle(frame, (px, py - 40), 12, (180, 190, 200), -1)
        # Torso
        cv2.rectangle(frame, (px - 14, py - 28), (px + 14, py + 15), (70, 90, 140), -1)
        # Legs
        leg_offset = int(math.sin(f * 0.8) * 6)
        cv2.line(frame, (px - 8, py + 15), (px - 10 + leg_offset, py + 55), (50, 50, 70), 4)
        cv2.line(frame, (px + 8, py + 15), (px + 10 - leg_offset, py + 55), (50, 50, 70), 4)
        
        # Frame counter & timestamp overlay
        cv2.putText(frame, f"CAM-01 [CORRIDOR A] {f:04d}", (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 128), 2)
        cv2.putText(frame, "2026-10-18 21:47:00 UTC", (400, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

        out.write(frame)

    out.release()
    print(f"Sample video created at {out_path} ({total_frames} frames)")

if __name__ == "__main__":
    import math
    create_sample_video()
