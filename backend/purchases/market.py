"""Real-retail price reference from Channel3. Optional and informational only:
it never changes offers, the exact review, approval or payment."""
import configparser
import json
import re
import urllib.error
import urllib.request
from django.conf import settings
from . import runtime_paypal

URL = "https://api.trychannel3.com/v1/search"
QUERY = {"cloth": "{width_cm} x {height_cm} cm microfiber cleaning cloths", "bag": "{capacity_l} liter trash bags",
         "bottle": "{volume_ml} ml empty spray bottles", "notebook": "{paper_size} notebooks"}
# Retail pack size as written in a listing title ("24 Pack", "50 Count", "Set of 6"); a title heuristic, labelled as such.
UNITS = re.compile(r"(?:(\d{1,4})\s*-?\s*(?:pack|pk|count|ct|pcs|pieces|bags|bottles)\b|(?:pack|set|box) of (\d{1,4})\b)", re.I)


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None  # urllib would copy x-api-key to the redirect target


_OPENER = urllib.request.build_opener(_NoRedirect)
_CACHE = {}  # ponytail: in-process, one search per request version; persist if API restarts must not re-spend credits


def api_key():
    try:
        parser = configparser.ConfigParser(interpolation=None)
        parser.optionxform = str
        parser.read_string("[runtime]\n" + runtime_paypal._private_text(settings.SPENDCONSENT_PAYPAL_CREDENTIALS, 16384))
        value = parser["runtime"].get("CHANNEL3_API_KEY", "").strip().strip("\"'")
        return value or None
    except (OSError, ValueError, UnicodeError, configparser.Error):
        return None


def units(title):
    match = UNITS.search(title)
    value = int(match.group(1) or match.group(2)) if match else None
    return value if value and 1 < value <= 1000 else None


def listing(product):
    offer = next((o for o in product.get("offers") or [] if o.get("availability") == "InStock"
                  and (o.get("price") or {}).get("currency") == "USD" and str(o.get("url", "")).startswith("https://")), None)
    if not offer or not isinstance(offer["price"].get("price"), (int, float)) or offer["price"]["price"] <= 0:
        return None
    cents = round(offer["price"]["price"] * 100)
    count = units(product.get("title", ""))
    image = next((i.get("url") for i in product.get("images") or [] if str(i.get("url", "")).startswith("https://")), None)
    return {"title": str(product.get("title", ""))[:160], "domain": str(offer.get("domain", ""))[:80], "url": offer["url"][:2000],
            "image": image[:2000] if image else None, "price_cents": cents, "units": count,
            "unit_cents": round(cents / count) if count else None}


def check(purchase):
    """Up to five comparable in-stock US retail listings for the understood item."""
    constraints = purchase.constraints or {}
    template = QUERY.get(constraints.get("category"))
    key = api_key()
    attributes = constraints.get("attributes") or {}
    if purchase.status != "READY" or not template or not key:
        return {"available": False}
    cache_key = (str(purchase.id), purchase.version)
    if cache_key not in _CACHE:
        try:
            query = template.format(**attributes)
        except KeyError:
            return {"available": False}
        body = json.dumps({"query": query, "limit": 10, "config": {"country": "US", "currency": "USD"}}).encode()
        request = urllib.request.Request(URL, body, {"Content-Type": "application/json", "x-api-key": key}, method="POST")
        try:
            with _OPENER.open(request, timeout=10) as response:
                products = json.loads(response.read(2_000_000)).get("products") or []
            rows = [row for row in map(listing, products) if row][:5]
        except (OSError, ValueError, AttributeError, TypeError, OverflowError):
            return {"available": False}  # not cached: a later look may succeed
        _CACHE[cache_key] = {"available": True, "source": "Channel3", "query": query, "listings": rows}
    return _CACHE[cache_key]
