"""
mission.py
----------
Mission Planner support: great-circle distance, and thin proxy clients for
two free, no-API-key services:

  - Open-Meteo Elevation API   (terrain elevation at a set of lat/lon points)
  - Open-Meteo Forecast API    (current weather at a lat/lon)

Both are public, free, and require no API key or account - matching the
"use free/open providers" choice made for this platform. Proxying them
through the backend (rather than calling them from the browser) keeps API
usage server-side and avoids CORS issues.

Both fetchers fail soft: if the outbound request errors or times out (no
network, provider down, etc.), they return `available=False` with a clear
`source` string rather than raising - a mission-planning tool should still
be usable (with a visible warning) when a third-party weather/elevation
service is temporarily unreachable, rather than hard-failing the request.
"""
import math
from typing import List, Optional, Tuple

import httpx

EARTH_RADIUS_KM = 6371.0088
ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HTTP_TIMEOUT_S = 6.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance (km) between two lat/lon points."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a)))


def fetch_elevations(points: List[Tuple[float, float]]) -> Tuple[List[float], str, bool]:
    """Batch-fetch terrain elevation (m) for a list of (lat, lon) points via
    the Open-Meteo Elevation API. Returns (elevations, source_label, available)."""
    if not points:
        return [], "open-meteo", True
    lats = ",".join(str(p[0]) for p in points)
    lons = ",".join(str(p[1]) for p in points)
    try:
        resp = httpx.get(ELEVATION_URL, params={"latitude": lats, "longitude": lons}, timeout=HTTP_TIMEOUT_S)
        resp.raise_for_status()
        data = resp.json()
        elevations = [float(e) for e in data.get("elevation", [])]
        if len(elevations) != len(points):
            raise ValueError("Elevation API returned a mismatched point count")
        return elevations, "open-meteo", True
    except Exception:
        # Fail soft: assume sea-level terrain (0 m) so the rest of the
        # mission computation can still proceed, clearly flagged upstream.
        return [0.0 for _ in points], "unavailable (assumed 0 m terrain)", False


def fetch_weather(lat: float, lon: float) -> dict:
    """Fetch current weather at a point via the Open-Meteo Forecast API."""
    try:
        resp = httpx.get(
            FORECAST_URL,
            params={
                "latitude": lat, "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m",
                "wind_speed_unit": "ms",
            },
            timeout=HTTP_TIMEOUT_S,
        )
        resp.raise_for_status()
        cur = resp.json().get("current", {})
        return dict(
            temperature_c=cur.get("temperature_2m"),
            pressure_hpa=cur.get("surface_pressure"),
            humidity_pct=cur.get("relative_humidity_2m"),
            wind_speed_ms=cur.get("wind_speed_10m"),
            wind_direction_deg=cur.get("wind_direction_10m"),
            source="open-meteo",
            available=True,
        )
    except Exception:
        return dict(
            temperature_c=None, pressure_hpa=None, humidity_pct=None,
            wind_speed_ms=None, wind_direction_deg=None,
            source="unavailable", available=False,
        )


def geocode_search(query: str, limit: int = 5) -> Tuple[list, bool]:
    """Free-text place search via OpenStreetMap's Nominatim (free, no API
    key). Nominatim's usage policy requires a descriptive User-Agent, set
    below. Proxied server-side (rather than called from the browser) to
    keep that policy compliance in one place and avoid CORS friction.
    Fails soft: returns an empty list + available=False rather than
    raising, since a geocoder outage shouldn't block mission planning."""
    if not query or not query.strip():
        return [], True
    try:
        resp = httpx.get(
            NOMINATIM_URL,
            params={"q": query, "format": "jsonv2", "limit": limit},
            headers={"User-Agent": "uav-flight-envelope-platform/1.0 (mission planner location search)"},
            timeout=HTTP_TIMEOUT_S,
        )
        resp.raise_for_status()
        data = resp.json()
        results = [
            {"display_name": r.get("display_name", ""), "lat": float(r["lat"]), "lon": float(r["lon"])}
            for r in data
        ]
        return results, True
    except Exception:
        return [], False
