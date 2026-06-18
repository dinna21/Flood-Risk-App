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

FLOOD_PRONE_DISTRICTS = [
    "Colombo", "Gampaha", "Galle", "Matara", "Kalutara",
    "Ratnapura", "Batticaloa",
]

# Coastal districts (also at risk during cyclones)
COASTAL_DISTRICTS = [
    "Colombo", "Gampaha", "Galle", "Matara", "Kalutara",
    "Hambantota", "Batticaloa", "Ampara", "Trincomalee",
    "Jaffna", "Mannar", "Puttalam",
]

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

# ══════════════════════════════════════════════════════════════════════════════
# DMC Flood Warning Scraper
# ══════════════════════════════════════════════════════════════════════════════

async def fetch_dmc_warnings() -> Dict[str, bool]:
    """
    Scrape DMC River Water Level & Flood Warning listing page for active warnings.

    Since actual water-level data is inside PDF downloads (not parseable from the
    listing page), this function checks:
      1. Are any reports posted today? (indicates active monitoring)
      2. Does any visible page text contain flood keywords?
      3. Are any district names mentioned near flood keywords?

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

        # Extract all visible text from the page (strips scripts, styles)
        page_text = soup.get_text(separator=" ", strip=True).lower()

        # Check if any flood-related keyword appears on the page
        has_general_warning = any(
            kw in page_text for kw in FLOOD_KEYWORDS
        )
        has_cyclone = "cyclone" in page_text

        # Find report listing rows
        report_rows = soup.select("table tr, .listing tr, .reports tr, .dmc-report")
        today_str = datetime.now().strftime("%Y-%m-%d")

        # Check if any report was posted today
        has_today_report = today_str in page_text if report_rows else False

        # Per-district matching: look for district names near flood keywords
        for district, aliases in DMC_DISTRICT_MATCHES.items():
            district_found = any(alias in page_text for alias in aliases)
            if district_found and has_general_warning:
                result[district] = True

        # Cyclone = broad trigger: flag all coastal districts
        if has_cyclone:
            for d in COASTAL_DISTRICTS:
                if not result[d]:
                    result[d] = True

        # If general warning exists but no specific districts matched,
        # flag historically flood-prone districts
        if has_general_warning and not any(result.values()):
            warning_active = has_today_report or has_general_warning
            if warning_active:
                for d in FLOOD_PRONE_DISTRICTS:
                    result[d] = True

        print(f"[DMC] Scraped successfully. General warning: {has_general_warning}, "
              f"Today reports: {has_today_report}, "
              f"Districts flagged: {sum(1 for v in result.values() if v)}")

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
        if rain_1h is not None:
            rainfall_7d = round(float(rain_1h) * 24 * 7, 2)
        elif rain_3h is not None:
            rainfall_7d = round(float(rain_3h) / 3 * 24 * 7, 2)
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
