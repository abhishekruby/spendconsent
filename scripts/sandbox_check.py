#!/usr/bin/env python3
"""Sandbox OAuth diagnostic. No payment APIs, raw responses, or secret logging."""
import argparse
import base64
import configparser
import getpass
import io
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

ENDPOINT = "https://api-m.sandbox.paypal.com/v1/oauth2/token"
ROOT = Path(__file__).resolve().parents[1]


class RejectRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def settings():
    config = configparser.ConfigParser(interpolation=None)
    config.optionxform = str
    path = ROOT / ".env"
    if path.exists():
        config.read_string("[runtime]\n" + path.read_text(encoding="utf-8"))
    values = config["runtime"] if config.has_section("runtime") else {}
    result = {}
    for key in ("PAYPAL_ENV", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"):
        value = os.environ.get(key, values.get(key, "")).strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        result[key] = value
    return result


def check(environment, client_id, client_secret, opener=None):
    if environment != "sandbox":
        return {"ok": False, "error": "SANDBOX_REQUIRED"}
    if not client_id or not client_secret:
        return {"ok": False, "error": "CREDENTIALS_REQUIRED"}
    if ":" in client_id or any(c.isspace() for c in client_id + client_secret):
        return {"ok": False, "error": "INVALID_CREDENTIAL_FORMAT"}
    encoded = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    request = Request(ENDPOINT, data=b"grant_type=client_credentials", headers={
        "Authorization": "Basic " + encoded,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
    }, method="POST")
    try:
        with (opener or build_opener(RejectRedirects())).open(request, timeout=20) as response:
            status = response.status
            data = json.load(response)
        valid = (status == 200 and isinstance(data, dict)
                 and isinstance(data.get("access_token"), str)
                 and bool(data["access_token"]) and data.get("token_type") == "Bearer"
                 and type(data.get("expires_in")) is int and data["expires_in"] > 0)
        if not valid:
            return {"ok": False, "http_status": status, "error": "INVALID_TOKEN_RESPONSE"}
        return {"ok": True, "environment": "sandbox", "http_status": status,
                "token_received": True, "expires_in_seconds": data["expires_in"]}
    except HTTPError as exc:
        return {"ok": False, "http_status": exc.code, "error": "PAYPAL_HTTP_ERROR"}
    except (URLError, TimeoutError, OSError):
        return {"ok": False, "error": "NETWORK_OR_TLS_ERROR"}
    except (ValueError, TypeError, AttributeError):
        return {"ok": False, "error": "INVALID_TOKEN_RESPONSE"}


def self_test():
    from unittest.mock import Mock, patch
    fixture_secret, fixture_token = "fixture-secret", "fixture-token"
    opener = Mock()
    body = io.StringIO(json.dumps({"access_token": fixture_token,
                                  "token_type": "Bearer", "expires_in": 3600}))
    body.status = 200
    opener.open.return_value = body
    result = check("sandbox", "fixture-id", fixture_secret, opener)
    assert result["ok"] and result["expires_in_seconds"] == 3600
    request = opener.open.call_args.args[0]
    assert request.full_url == ENDPOINT and request.method == "POST"
    assert request.data == b"grant_type=client_credentials"
    assert base64.b64decode(request.headers["Authorization"][6:]).decode() == "fixture-id:" + fixture_secret
    assert fixture_secret not in json.dumps(result) and fixture_token not in json.dumps(result)
    opener.reset_mock()
    assert check("live", "fixture-id", fixture_secret, opener)["error"] == "SANDBOX_REQUIRED"
    assert check("sandbox", "", "", opener)["error"] == "CREDENTIALS_REQUIRED"
    assert check("sandbox", "id\n", fixture_secret, opener)["error"] == "INVALID_CREDENTIAL_FORMAT"
    opener.open.assert_not_called()
    opener.open.side_effect = HTTPError(ENDPOINT, 401, fixture_secret, {}, io.BytesIO(fixture_token.encode()))
    assert check("sandbox", "fixture-id", fixture_secret, opener) == {"ok": False, "http_status": 401, "error": "PAYPAL_HTTP_ERROR"}
    assert RejectRedirects().redirect_request(None, None, 302, "", {}, "https://example.com") is None
    config = "PAYPAL_ENV=sandbox\nPAYPAL_CLIENT_ID=\"fixture-id\"\nPAYPAL_CLIENT_SECRET='fixture-secret'\n"
    with patch.dict(os.environ, {}, clear=True), patch.object(Path, "exists", return_value=True), patch.object(Path, "read_text", return_value=config):
        assert settings()["PAYPAL_CLIENT_SECRET"] == fixture_secret
    print(json.dumps({"self_test": "passed", "network_calls": 0}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prompt", action="store_true", help="Read both credentials using hidden terminal prompts")
    parser.add_argument("--self-test", action="store_true", help="Run offline checks with dummy credentials")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0
    try:
        values = settings()
    except (OSError, UnicodeError, configparser.Error):
        print(json.dumps({"ok": False, "error": "INVALID_LOCAL_CONFIG"}))
        return 1
    if args.prompt:
        if not sys.stdin.isatty():
            print(json.dumps({"ok": False, "error": "INTERACTIVE_TERMINAL_REQUIRED"}))
            return 1
        try:
            values["PAYPAL_CLIENT_ID"] = getpass.getpass("Sandbox client ID (hidden): ")
            values["PAYPAL_CLIENT_SECRET"] = getpass.getpass("Sandbox client secret (hidden): ")
        except (EOFError, KeyboardInterrupt):
            print(json.dumps({"ok": False, "error": "INPUT_CANCELLED"}))
            return 1
    result = check(values["PAYPAL_ENV"], values["PAYPAL_CLIENT_ID"], values["PAYPAL_CLIENT_SECRET"])
    print(json.dumps(result))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
