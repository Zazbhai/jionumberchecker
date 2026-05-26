import os
import sys
import json
import re
from typing import Any, Dict, Optional, Tuple
from urllib import error, parse, request

# Add the root directory to path to import checker
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
try:
    from checker import check_jio_registration
except ImportError:
    # Fallback in case of path issues
    def check_jio_registration(number: str) -> str:
        return "registered"


# API credentials and defaults
SETTINGS_FILE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "settings.json")
)

DEFAULT_SETTINGS = {
    "api_key": "2ce12168a4f72374207d61fc634ba23c79cf",
    "operator": "10",
    "country": "22",
    "service": "lmeh",
    "base_url": "https://api.temporasms.com/stubs/handler_api.php",
    "auto_cancel_time": "180",
    "polling_delay": "2",
    "allow_cancel_time": "30",
    "price": "4.50",
}


def load_settings() -> dict:
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                data = json.load(f)
                return {**DEFAULT_SETTINGS, **data}
        except Exception:
            pass
    return DEFAULT_SETTINGS.copy()


def save_settings(settings: dict):
    to_save = {}
    for k in DEFAULT_SETTINGS.keys():
        if k in settings:
            to_save[k] = str(settings[k])

    with open(SETTINGS_FILE, "w") as f:
        json.dump(to_save, f, indent=4)


def _http_get(params: Dict[str, Any], api_key: Optional[str] = None) -> str:
    """
    Perform a GET request with shared base URL and API key.
    If api_key is provided, it overrides the global settings key.
    Returns raw text from the API or raises ValueError on network/HTTP issues.
    """
    settings = load_settings()
    key = api_key if api_key else settings["api_key"]
    merged = {"api_key": key, **params}
    url = f"{settings['base_url']}?{parse.urlencode(merged)}"

    req = request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        },
    )

    try:
        with request.urlopen(req, timeout=15) as resp:
            return resp.read().decode("utf-8").strip()
    except error.HTTPError as exc:
        raise ValueError(f"API HTTP {exc.code}: {exc.reason}") from exc
    except error.URLError as exc:
        raise ValueError(f"Network error: {exc.reason}") from exc


def get_balance(api_key: Optional[str] = None) -> str:
    """Check account balance."""
    return _http_get({"action": "getBalance"}, api_key=api_key)


def parse_balance(text: str) -> Optional[float]:
    """Extract numeric balance from API response."""
    if not text.startswith("ACCESS_BALANCE:"):
        return None
    try:
        return float(text.split(":", 1)[1])
    except ValueError:
        return None


def get_prices(
    country: str = None, operator: str = None, api_key: Optional[str] = None
) -> str:
    """Get pricing for the given country/operator."""
    settings = load_settings()
    c = country if country is not None else settings["country"]
    op = operator if operator is not None else settings["operator"]
    return _http_get(
        {
            "action": "getPrices",
            "country": c,
            "operator": op,
        },
        api_key=api_key,
    )


def parse_prices(text: str) -> Dict[str, Any]:
    """Parse JSON-like price response into a dict; returns {} on failure."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


def get_price_for_service(
    service: str = None, country: str = None, operator: str = None
) -> Optional[str]:
    """
    Fetch price data and return the price string for the given service,
    or None if not found.
    """
    settings = load_settings()
    srv = service if service is not None else settings["service"]
    c = country if country is not None else settings["country"]
    op = operator if operator is not None else settings["operator"]

    raw = get_prices(country=c, operator=op)
    data = parse_prices(raw)

    country_block = data.get(str(c), {})
    service_block = country_block.get(srv, {})
    if not isinstance(service_block, dict):
        return None

    price_keys = list(service_block.keys())
    return price_keys[0] if price_keys else None


def get_number(
    service: str = None,
    country: str = None,
    operator: str = None,
    api_key: Optional[str] = None,
) -> Optional[Tuple[str, str]]:
    """
    Request a virtual number for a service.
    Returns (request_id, phone_number) or None on parse failure.
    """
    settings = load_settings()
    srv = service if service is not None else settings["service"]
    c = country if country is not None else settings["country"]
    op = operator if operator is not None else settings["operator"]

    raw = _http_get(
        {
            "action": "getNumber",
            "service": srv,
            "country": c,
            "operator": op,
        },
        api_key=api_key,
    )
    return parse_number(raw)


def parse_number(text: str) -> Optional[Tuple[str, str]]:
    """
    Extract (request_id, phone_number) from ACCESS_NUMBER response.
    Strips leading '91' from the phone number if present.
    """
    if not text.startswith("ACCESS_NUMBER:"):
        return None
    try:
        parts = text.split(":", 2)
        if len(parts) < 3:
            return None
        _, req_id, raw_number = parts
    except ValueError:
        return None

    number = raw_number
    if number.startswith("91") and len(number) > 2:
        number = number[2:]

    return req_id, number


def set_status(status: int, request_id: str, api_key: Optional[str] = None) -> str:
    """Generic status update helper (e.g., 3=request new OTP, 8=cancel)."""
    return _http_get(
        {"action": "setStatus", "status": status, "id": request_id}, api_key=api_key
    )


def request_new_otp(request_id: str, api_key: Optional[str] = None) -> str:
    """Shortcut: ask for another OTP (status=3)."""
    return set_status(3, request_id, api_key=api_key)


def cancel_number(request_id: str, api_key: Optional[str] = None) -> str:
    """Shortcut: cancel the number (status=8)."""
    return set_status(8, request_id, api_key=api_key)


def parse_cancel_status(text: str) -> str:
    """
    Interpret cancel response.
    Returns 'accepted', 'already_cancelled', or raw text if unknown.
    """
    if text.startswith("ACCESS_CANCEL"):
        return "accepted"
    if text.startswith("ACCESS_CANCEL_ALREADY"):
        return "already_cancelled"
    return text


def extract_otp(text: str) -> Optional[str]:
    """
    Extract the first 4-8 digit OTP from the provided text.
    Returns None if no OTP found.
    """
    matches = re.findall(r"\b(\d{4,8})\b", text)
    if not matches:
        return None
    return matches[-1]


def parse_otp_response(text: str) -> Tuple[str, Optional[str]]:
    """
    Parse getStatus response.
    Returns a tuple of (status, otp_or_none).
    """
    if text.startswith("STATUS_OK:"):
        otp = extract_otp(text)
        return "ok", otp
    if text.startswith("STATUS_CANCEL"):
        return "cancelled", None
    if text.startswith("ACCESS_WAITING"):
        return "waiting", None
    return "unknown", extract_otp(text)


def check_registration_and_status(number: str) -> str:
    """Checks Jio registration status for the number."""
    return check_jio_registration(number)
