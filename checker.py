from typing import Dict, Literal, Optional

import requests

JioRegistrationStatus = Literal["registered", "not_registered", "retry"]

_RETRYABLE_STATUS = {400, 401, 403, 408, 425, 429, 500, 502, 503, 504}


def check_jio_registration(
    number: str,
    proxies: Optional[Dict[str, str]] = None,
) -> JioRegistrationStatus:
    url = (
        "https://www.jio.com/api/jio-recharge-service/recharge/mobility/number/"
        f"{number}"
    )

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json",
        "Referer": "https://www.jio.com/",
    }

    try:
        response = requests.get(
            url,
            headers=headers,
            timeout=20,
            proxies=proxies,
        )
    except requests.RequestException:
        return "retry"

    try:
        data = response.json()
    except ValueError:
        data = {}

    error_message = data.get("errorMessage") or data.get("message") or ""

    if error_message == "NOT_SUBSCRIBED_USER":
        print(f"{number} => Not Registered")
        return "not_registered"

    if response.ok:
        print(f"{number} => Registered")
        return "registered"

    if response.status_code in _RETRYABLE_STATUS:
        print(f"{number} => Check failed ({response.status_code}), will retry")
        return "retry"

    if response.status_code == 404:
        print(f"{number} => Not Registered (404)")
        return "not_registered"

    print(f"{number} => Check failed ({response.status_code})")
    return "retry"


def is_jio_registered(
    number: str,
    proxies: Optional[Dict[str, str]] = None,
) -> bool:
    """Backward-compatible helper — only True when API confirms registered."""
    return check_jio_registration(number, proxies) == "registered"


def check_jio(number: str) -> None:
    try:
        status = check_jio_registration(number)
        print(f"{number} => {status}")
    except Exception as exc:
        print(f"{number} => Error: {exc}")
