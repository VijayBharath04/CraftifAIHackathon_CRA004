import pytest
from app.services.zone_service import point_in_polygon, dist_point_to_segment, dist_point_to_polygon

def test_point_in_polygon_square():
    # Square from (0.2, 0.2) to (0.8, 0.8)
    poly = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]]
    
    # Inside center
    assert point_in_polygon(0.5, 0.5, poly) is True
    # Inside near boundary
    assert point_in_polygon(0.25, 0.25, poly) is True
    
    # Outside left
    assert point_in_polygon(0.1, 0.5, poly) is False
    # Outside right
    assert point_in_polygon(0.9, 0.5, poly) is False
    # Outside top
    assert point_in_polygon(0.5, 0.1, poly) is False
    # Outside bottom
    assert point_in_polygon(0.5, 0.9, poly) is False

def test_point_in_triangle():
    # Triangle: (0.1, 0.1), (0.9, 0.1), (0.5, 0.9)
    poly = [[0.1, 0.1], [0.9, 0.1], [0.5, 0.9]]
    assert point_in_polygon(0.5, 0.3, poly) is True
    assert point_in_polygon(0.1, 0.8, poly) is False

def test_dist_point_to_segment():
    # Horizontal segment (0, 0) to (10, 0)
    # Point (5, 5) -> distance 5
    d = dist_point_to_segment(5, 5, 0, 0, 10, 0)
    assert pytest.approx(d, 0.001) == 5.0
    
    # Point beyond segment (15, 0) -> distance to (10, 0) = 5
    d2 = dist_point_to_segment(15, 0, 0, 0, 10, 0)
    assert pytest.approx(d2, 0.001) == 5.0

def test_dist_point_to_polygon():
    poly = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]]
    # Point at (0.1, 0.5): distance to left edge x=0.2 is 0.1
    d = dist_point_to_polygon(0.1, 0.5, poly)
    assert pytest.approx(d, 0.001) == 0.1
