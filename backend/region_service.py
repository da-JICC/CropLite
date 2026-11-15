"""Small-field WGS84 polygon validation and region metadata.

No external GIS dependency: fields are intentionally limited to a small extent.
NASA POWER uses a representative point, not a polygon temperature average.
"""
from __future__ import annotations

import math
from typing import Any

EARTH_RADIUS_M = 6_371_008.8


def _turn(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _on_segment(a, b, c):
    return (min(a[0], b[0]) <= c[0] <= max(a[0], b[0]) and
            min(a[1], b[1]) <= c[1] <= max(a[1], b[1]))


def _intersects(a, b, c, d):
    s1, s2, s3, s4 = _turn(a, b, c), _turn(a, b, d), _turn(c, d, a), _turn(c, d, b)
    eps = 1e-12
    if (s1 > eps and s2 < -eps or s1 < -eps and s2 > eps) and \
       (s3 > eps and s4 < -eps or s3 < -eps and s4 > eps):
        return True
    return ((abs(s1) < eps and _on_segment(a, b, c)) or
            (abs(s2) < eps and _on_segment(a, b, d)) or
            (abs(s3) < eps and _on_segment(c, d, a)) or
            (abs(s4) < eps and _on_segment(c, d, b)))


def _contains(point, ring):
    x, y = point
    inside = False
    for a, b in zip(ring, ring[1:]):
        if (a[1] > y) != (b[1] > y):
            x_at_y = a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])
            if x_at_y > x:
                inside = not inside
    return inside


def validate_region_polygon(polygon: dict[str, Any]) -> dict:
    if not isinstance(polygon, dict) or polygon.get('type') != 'Polygon':
        raise ValueError('Only GeoJSON Polygon is supported')
    rings = polygon.get('coordinates')
    if not isinstance(rings, list) or len(rings) != 1:
        raise ValueError('A single polygon ring without holes is required')
    ring = rings[0]
    if not isinstance(ring, list) or not (4 <= len(ring) <= 41):
        raise ValueError('A closed ring with 3 to 40 vertices is required')
    if any(not isinstance(p, (list, tuple)) or len(p) != 2 or
           any(not isinstance(n, (float, int)) or isinstance(n, bool) or not math.isfinite(n) for n in p) or
           not (-180 <= p[0] <= 180 and -90 <= p[1] <= 90) for p in ring):
        raise ValueError('Coordinates must be finite [longitude, latitude] values in WGS84')
    if ring[0] != ring[-1] or len({tuple(p) for p in ring[:-1]}) != len(ring) - 1:
        raise ValueError('Close the polygon and avoid repeated vertices')
    if len(ring) < 4:
        raise ValueError('A polygon must have at least three vertices')
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    if max(xs) - min(xs) > 0.10 or max(ys) - min(ys) > 0.10:
        raise ValueError('The prototype supports small fields up to roughly 10 km across')
    shoelace = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:]))
    if abs(shoelace) <= 1e-10:
        raise ValueError('The selected polygon has no area')
    n = len(ring) - 1
    for i in range(n):
        for j in range(i + 1, n):
            if abs(i - j) == 1 or (i == 0 and j == n - 1):
                continue
            if _intersects(ring[i], ring[i+1], ring[j], ring[j+1]):
                raise ValueError('Polygon edges intersect. Edit the boundary to remove crossings')
    return polygon


def describe_region(polygon: dict) -> dict:
    ring = polygon['coordinates'][0]
    signed_twice = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:]))
    lon = sum((a[0] + b[0]) * (a[0] * b[1] - b[0] * a[1]) for a, b in zip(ring, ring[1:])) / (3 * signed_twice)
    lat = sum((a[1] + b[1]) * (a[0] * b[1] - b[0] * a[1]) for a, b in zip(ring, ring[1:])) / (3 * signed_twice)
    if not _contains((lon, lat), ring):
        # For a concave polygon, choose a point demonstrably within its interior.
        candidates = sorted(set([sum(p[1] for p in ring[:-1]) / (len(ring)-1), (min(p[1] for p in ring)+max(p[1] for p in ring))/2,
                                  *[(a[1]+b[1])/2 for a,b in zip(ring,ring[1:])]]))
        for y in candidates:
            intersections = sorted(a[0] + (y-a[1])*(b[0]-a[0])/(b[1]-a[1])
                                   for a,b in zip(ring,ring[1:]) if (a[1] > y) != (b[1] > y))
            if len(intersections) >= 2:
                pairs = [(intersections[k+1] - intersections[k], (intersections[k+1] + intersections[k])/2)
                         for k in range(0,len(intersections)-1,2)]
                _, lon = max(pairs)
                lat = y
                break
    # Spherical polygon area, good for small fields without geographic projection.
    square_m = abs(sum(math.radians(b[0] - a[0]) *
                       (math.sin(math.radians(a[1])) + math.sin(math.radians(b[1])))
                       for a,b in zip(ring, ring[1:])) * (EARTH_RADIUS_M ** 2) / 2)
    return {
        'area_hectares': round(square_m / 10_000, 4),
        'representative_point': {'latitude': round(lat, 6), 'longitude': round(lon, 6)},
        'bounds': {'west': min(p[0] for p in ring), 'south': min(p[1] for p in ring),
                   'east': max(p[0] for p in ring), 'north': max(p[1] for p in ring)},
        'geometry': polygon,
        'crs': 'EPSG:4326',
    }
