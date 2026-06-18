"""
Live data integration module for Sri Lanka Flood Risk Intelligence System.

Sources:
  1. DMC (Disaster Management Centre) — scrapes River Water Level & Flood Warning reports
  2. OpenWeatherMap API — fetches current weather for 24 Sri Lankan districts

Both sources gracefully degrade — never crash the server if unreachable.
"""

import os
import re
from datetime import datetime
from typing import Dict, List, Optional

import httpx
from bs4 import BeautifulSoup

# ── District name mappings ──────────────────────────────────────────────────

DMC_DISTRICT_MATCHES: Dict[str, List[str]] = {
    "Colombo":       ["colombo"],
    "Gampaha":       ["gampaha"],
    "Kandy":         ["kandy"],
    "Galle":         ["galle"],
    "Matara":        ["matara"],
    "Hambantota":    ["hambantota"],
    "Kurunegala":    ["kurunegala"],
    "Ratnapura":     ["ratnapura"],
    "Kalutara":      ["kalutara"],
    "Badulla":       ["badulla"],
    "Monaragala":    ["monaragala", "moneragala"],
    "Polonnaruwa":   ["polonnaruwa"],
    "Anuradhapura":  ["anuradhapura"],
    "Trincomalee":   ["trincomalee", "trinco"],
    "Batticaloa":    ["batticaloa", "batticalo"],
    "Ampara":        ["ampara"],
    "Jaffna":        ["jaffna"],
    "Kilinochchi":   ["kilinochchi"],
    "Mannar":        ["mannar"],
    "Vavuniya":      ["vavuniya"],
    "Nuwara Eliya":  ["nuwara eliya", "nuwara-eliya", "nuwaraeliya"],
    "Kegalle":       ["kegalle", "kegalla"],
    "Matale":        ["matale"],
    "Puttalam":      ["puttalam", "puttlam"],
}

FLOOD_KEYWORDS = [
    "flood", "warning", "alert", "inundation", "evacuate",
    "red alert", "orange alert", "overflow", "spill",
    "water level", "heavy rain", "landslide", "cyclone",
]

# Monsoon-season expected rainfall estimates (mm/7-day, from Met Dept climatology)
# SW Monsoon (May-Sep): wet in west, south, central hills. NE Monsoon (Dec-Feb): wet in east, north.
MONSOON_RAINFALL_DEFAULTS: Dict[str, float] = {
    # Southwest monsoon (current: June) — wet zone districts
    "Colombo":      45.0,
    "Gampaha":      40.0,
    "Kandy":        35.0,
    "Galle":        50.0,
    "Matara":       45.0,
    "Kalutara":     50.0,
    "Ratnapura":    55.0,
    "Kegalle":      40.0,
    "Nuwara Eliya": 35.0,
    "Badulla":      30.0,
    "Monaragala":   25.0,
    # Intermediate zone — moderate rain
    "Kurunegala":   25.0,
    "Matale":       25.0,
    "Polonnaruwa":  20.0,
    "Ampara":       20.0,
    "Batticaloa":   20.0,
    "Trincomalee":  15.0,
    # Dry zone — minimal rain during SW monsoon
    "Hambantota":    15.0,
    "Anuradhapura":  15.0,
    "Jaffna":        10.0,
    "Kilinochchi":   10.0,
    "Mannar":        10.0,
    "Vavuniya":      15.0,
    "Puttalam":      20.0,
    "Mullaitivu":    10.0,
}

# Map Sinhala weather terms to Met Dept rainfall categories (mm/day)
WEATHER_CATEGORIES: Dict[str, float] = {
    "light": 6.0, "light rain": 6.0, "සිහින් වැසි": 6.0,
    "light to moderate": 18.0, "සිහින් හෝ මද": 18.0,
    "moderate": 35.0, "මද වැසි": 35.0,
    "fairly heavy": 75.0, "තරමක් තද": 75.0,
    "heavy": 125.0, "තද වැසි": 125.0,
    "very heavy": 175.0, "ඉතා තද": 175.0,
    "showers": 12.0, "thundershowers": 15.0,
}

# DMC report listing URLs (Joomla CMS)
DMC_RIVER_WATER_URL = (
    "https://www.dmc.gov.lk/index.php"
    "?option=com_dmcreports&view=reports&Itemid=277&report_type_id=6&lang=en"
)

OWM_CITY_MAP: Dict[str, str] = {
    "Colombo":       "Colombo",
    "Gampaha":       "Gampaha",
    "Kandy":         "Kandy",
    "Galle":         "Galle",
    "Matara":        "Matara",
    "Hambantota":    "Hambantota",
    "Kurunegala":    "Kurunegala",
    "Ratnapura":     "Ratnapura",
    "Kalutara":      "Kalutara",
    "Badulla":       "Badulla",
    "Monaragala":    "Monaragala",
    "Polonnaruwa":   "Polonnaruwa",
    "Anuradhapura":  "Anuradhapura",
    "Trincomalee":   "Trincomalee",
    "Batticaloa":    "Batticaloa",
    "Ampara":        "Ampara",
    "Jaffna":        "Jaffna",
    "Kilinochchi":   "Kilinochchi",
    "Mannar":        "Mannar",
    "Vavuniya":      "Vavuniya",
    "Nuwara Eliya":  "Nuwara Eliya",
    "Kegalle":       "Kegalle",
    "Matale":        "Matale",
    "Puttalam":      "Puttalam",
}

OWM_BASE_URL = "https://api.openweathermap.org/data/2.5/weather"

# ── Strong flood warning keywords (match actual DMC report title patterns) ───
STRONG_KEYWORDS = [
    "flood warning", "flood alert", "inundation warning",
    "flash flood", "river flood", "evacuation", "overflow",
    "spill gates", "red alert", "orange alert",
]

FLOOD_PRONE_DISTRICTS = [
    "Ratnapura", "Kalutara", "Galle", "Matara",
    "Batticaloa", "Kegalle", "Colombo",
]

# ══════════════════════════════════════════════════════════════════════════════
# DMC Flood Warning Scraper
# ══════════════════════════════════════════════════════════════════════════════

async def fetch_dmc_warnings() -> Dict[str, bool]:
    """
    Scrape DMC River Water Level & Flood Warning listing page for active warnings.

    Parses ONLY the PDF title column from the reports table (not full page text).
    Checks the 5 most recent report titles for:
      1. Strong flood keywords (e.g. "flood warning", "flash flood")
      2. District name aliases mentioned alongside those keywords

    Returns: Dict[district_name, True/False] for all 24 districts.
    """
    result: Dict[str, bool] = {d: False for d in DMC_DISTRICT_MATCHES}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                DMC_RIVER_WATER_URL,
                headers={"User-Agent": "Mozilla/5.0 (compatible; FloodRiskBot/1.0)"},
            )
            response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Parse ONLY the <td> title column from the reports table
        titles: List[str] = []
        for row in soup.select("table tr"):
            tds = row.find_all("td")
            if tds:
                title = tds[0].get_text(strip=True)
                if title and len(title) > 2:
                    titles.append(title)

        # Check only the last 5 most recent report titles
        recent = titles[:5]
        combined = " ".join(recent).lower()
        has_strong_keyword = any(kw in combined for kw in STRONG_KEYWORDS)

        if not has_strong_keyword:
            print(f"[DMC] No strong flood keywords in recent titles: {recent[:3]}")
            return result

        # Per-title district matching
        any_district_matched = False
        for title in recent:
            title_lower = title.lower()
            for district, aliases in DMC_DISTRICT_MATCHES.items():
                district_in_title = any(alias in title_lower for alias in aliases)
                flood_in_title = any(kw in title_lower for kw in STRONG_KEYWORDS)
                if district_in_title and flood_in_title:
                    result[district] = True
                    any_district_matched = True

        # Fallback: strong keywords exist but no specific district → flag flood-prone
        if not any_district_matched:
            for d in FLOOD_PRONE_DISTRICTS:
                result[d] = True

        flagged = sum(1 for v in result.values() if v)
        print(f"[DMC] Recent titles: {recent[:3]}, "
              f"Strong keyword: {has_strong_keyword}, "
              f"Districts flagged: {flagged}")

    except httpx.HTTPError as e:
        print(f"[DMC] HTTP error: {e}")
    except httpx.TimeoutException:
        print("[DMC] Request timed out")
    except Exception as e:
        print(f"[DMC] Unexpected error: {e}")

    return result


# ══════════════════════════════════════════════════════════════════════════════
# OpenWeatherMap Rainfall Fetcher
# ══════════════════════════════════════════════════════════════════════════════

async def _fetch_one_city(
    client: httpx.AsyncClient,
    district: str,
    city_query: str,
    api_key: str,
) -> Optional[dict]:
    """Fetch weather data for a single city. Returns None on failure."""
    try:
        response = await client.get(
            OWM_BASE_URL,
            params={"q": f"{city_query},LK", "appid": api_key, "units": "metric"},
        )
        response.raise_for_status()
        data = response.json()

        rain = data.get("rain", {})
        rain_1h = rain.get("1h")  # mm in last hour
        rain_3h = rain.get("3h")  # mm in last 3 hours

        # Estimate 7-day rainfall from hourly data
        # Conservative 6-hour projection from current hourly rate, capped at 300mm
        if rain_1h is not None:
            rainfall_7d = round(min(float(rain_1h) * 6, 300.0), 2)
        elif rain_3h is not None:
            rainfall_7d = round(min(float(rain_3h) / 3 * 6, 300.0), 2)
        else:
            rainfall_7d = None  # No rain data available (not currently raining)

        return {
            "rainfall_7d_mm": rainfall_7d,
            "temperature_c": round(data["main"]["temp"], 1),
            "humidity_pct": data["main"]["humidity"],
            "weather_desc": data["weather"][0]["description"],
            "weather_main": data["weather"][0]["main"],
        }

    except httpx.HTTPError as e:
        print(f"[OWM] HTTP error for {district}: {e}")
    except httpx.TimeoutException:
        print(f"[OWM] Timeout for {district}")
    except (KeyError, TypeError, ValueError) as e:
        print(f"[OWM] Parse error for {district}: {e}")
    except Exception as e:
        print(f"[OWM] Unexpected error for {district}: {e}")

    return None


async def fetch_owm_rainfall(api_key: str) -> Dict[str, Optional[dict]]:
    """
    Fetch current weather data for all 24 Sri Lankan districts from OpenWeatherMap.

    Uses concurrent async requests for speed.  Gracefully handles individual
    city failures — missing cities return None.

    Returns: Dict[district_name, dict_or_None]
      dict keys: rainfall_7d_mm, temperature_c, humidity_pct, weather_desc, weather_main
    """
    if not api_key or api_key.strip() == "":
        print("[OWM] No API key configured — skipping")
        return {d: None for d in OWM_CITY_MAP}

    result: Dict[str, Optional[dict]] = {}

    async with httpx.AsyncClient(timeout=10.0) as client:
        tasks = [
            _fetch_one_city(client, district, city_query, api_key)
            for district, city_query in OWM_CITY_MAP.items()
        ]
        results_list = await _gather(*tasks)

        for district, data in zip(OWM_CITY_MAP.keys(), results_list):
            if isinstance(data, BaseException):
                print(f"[OWM] Exception for {district}: {data}")
                result[district] = None
            else:
                result[district] = data

    success_count = sum(1 for v in result.values() if v is not None)
    print(f"[OWM] Fetched {success_count}/{len(result)} districts successfully")

    return result


async def _gather(*coros):
    """Convenience wrapper for asyncio.gather with return_exceptions."""
    import asyncio
    return await asyncio.gather(*coros, return_exceptions=True)
