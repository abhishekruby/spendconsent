#!/usr/bin/env python3
"""SpendConsent as an MCP server: any AI agent can shop, none can pay.

Stdio JSON-RPC (Model Context Protocol), stdlib only. The agent can find offers,
prepare an exact cart and ask the owner to approve it. There is deliberately no
tool that approves or pays: the approval link opens in the owner's browser and
its token never enters the agent's context. Talks to the local SpendConsent API.

Claude Desktop / Claude Code config:
  {"mcpServers": {"spendconsent": {"command": "python3", "args": ["<repo>/scripts/spendconsent_mcp.py"]}}}
Self-check (API not needed): python3 scripts/spendconsent_mcp.py --self-test
"""
import http.cookiejar
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
import webbrowser

API = os.environ.get("SPENDCONSENT_API", "http://127.0.0.1:8000")
WEB = os.environ.get("SPENDCONSENT_WEB", "http://127.0.0.1:5173")
NO_PAY = "This tool cannot approve or pay; only the owner can, in their own browser."


class Api:
    def __init__(self):
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.csrf = None

    def call(self, method, path, body=None):
        if self.csrf is None:
            self.csrf = ""  # set before the recursive call so it runs once
            try:
                self.csrf = self.call("GET", "/api/session")["csrf_token"]
            except ToolError:
                self.csrf = None  # retry on the next call once the API is up
                raise
        headers = {"Accept": "application/json"}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers.update({"Content-Type": "application/json", "X-CSRFToken": self.csrf})
        try:
            with self.http.open(urllib.request.Request(API + path, data, headers, method=method), timeout=200) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            try:
                error = json.load(exc).get("error", {})
            except ValueError:
                error = {}
            raise ToolError(f"{error.get('code', exc.code)}: {error.get('message', 'request rejected')}")
        except (OSError, ValueError):
            raise ToolError("SpendConsent is not reachable. Start it with scripts/run_demo.sh.")


class ToolError(Exception):
    pass


def money(cents):
    return f"${cents / 100:.2f}"


class Shop:
    def __init__(self, api):
        self.api = api
        self.request = None

    def current(self):
        if not self.request:
            raise ToolError("No purchase yet. Call find_offers first.")
        self.request = self.api.call("GET", f"/api/requests/{self.request['id']}")
        return self.request

    def find_offers(self, request):
        self.request = self.api.call("POST", "/api/requests", {"text": request, "client_submission_id": str(uuid.uuid4())})
        deadline = time.monotonic() + 150
        while self.request["status"] == "COMPARING":
            if time.monotonic() > deadline:
                return "Still comparing. Call purchase_status shortly."
            time.sleep(2)
            self.current()
        r = self.request
        if r["status"] == "NEEDS_CLARIFICATION":
            return f"The buyer must clarify: {r['clarification']['question']} Call find_offers again with the full request."
        lines = [f"Status: {r['status']}. Understood: {json.dumps(r['constraints'])}"]
        lines += [f"- offer_id {c['id']}: {c['name']} ({c['specification']}), {c['packs']} pack(s) = {c['individual_units']} units, "
                  f"delivered total {money(c['total_cents'])} incl. {money(c['shipping_cents'])} delivery and {money(c['tax_cents'])} tax"
                  for c in r["candidates"]]
        lines += [f"- ruled out {x['name']}: {' '.join(x['reasons'])}" for x in r["excluded"]]
        return "\n".join(lines) + ("\nNext: prepare_cart with one offer_id." if r["candidates"] else "")

    def prepare_cart(self, offer_id):
        r = self.current()
        self.request = self.api.call("POST", f"/api/requests/{r['id']}/reviews", {"expected_version": r["version"], "candidate_id": offer_id})
        v = self.request["review"]
        return (f"Exact cart: {v['item']['packs']} x {v['item']['name']} (SKU {v['item']['sku']}) from {v['merchant']['name']}; "
                f"total {money(v['total_cents'])} {v['currency']}; expires {v['expires_at']}.\n"
                f"Next: request_owner_approval. {NO_PAY}")

    def request_owner_approval(self):
        review = self.current()["review"]
        if not review:
            raise ToolError("No exact cart yet. Call prepare_cart first.")
        token = self.api.call("POST", f"/api/reviews/{review['id']}/link", {})["token"]
        # The token is the owner's authority: hand it to the browser, never to the agent.
        if not webbrowser.open(f"{WEB}/?approve={token}"):
            return "Could not open the owner's browser. Ask the owner to open SpendConsent and approve the cart there."
        return f"Sent to the owner for approval of {money(review['total_cents'])}. {NO_PAY} Use purchase_status to follow it."

    def purchase_status(self):
        r = self.current()
        approval, attempt = r["approval"], r["attempt"]
        parts = [f"Request {r['status']}"]
        if r["review"] and not approval:
            parts.append(f"exact cart {money(r['review']['total_cents'])} waiting for the owner's approval")
        if approval:
            parts.append(f"approval {approval['status']}")
        if attempt:
            parts.append(f"payment {attempt['state']}" + (f" ({attempt['reason_code']})" if attempt["reason_code"] else ""))
        return ", ".join(parts) + "." + (" Paid and verified with PayPal." if attempt and attempt["state"] == "PAID" else "")


TOOLS = [
    {"name": "find_offers", "description": "Compare supplier offers for a plain-language purchase request (item, exact quantity, size, budget incl. delivery and tax). Takes ~20 s.",
     "inputSchema": {"type": "object", "properties": {"request": {"type": "string", "maxLength": 2000}}, "required": ["request"]}},
    {"name": "prepare_cart", "description": "Freeze one offer from find_offers into an exact, expiring cart for the owner to review.",
     "inputSchema": {"type": "object", "properties": {"offer_id": {"type": "string"}}, "required": ["offer_id"]}},
    {"name": "request_owner_approval", "description": f"Open the exact cart in the owner's browser for approval. {NO_PAY}",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "purchase_status", "description": "Current state of the purchase: approval and PayPal payment.",
     "inputSchema": {"type": "object", "properties": {}}},
]


def handle(shop, message):
    method, params = message.get("method"), message.get("params") or {}
    if method == "initialize":
        return {"protocolVersion": "2025-06-18", "capabilities": {"tools": {}},
                "serverInfo": {"name": "spendconsent", "version": "1.0"}}
    if method == "ping":
        return {}
    if method == "tools/list":
        return {"tools": TOOLS}
    if method == "tools/call":
        name, args = params.get("name"), params.get("arguments") or {}
        if name not in {tool["name"] for tool in TOOLS}:
            return {"content": [{"type": "text", "text": f"Unknown tool {name}."}], "isError": True}
        try:
            return {"content": [{"type": "text", "text": getattr(shop, name)(**args)}]}
        except (ToolError, TypeError) as exc:
            return {"content": [{"type": "text", "text": str(exc)}], "isError": True}
        except Exception:
            return {"content": [{"type": "text", "text": "Unexpected error; call purchase_status."}], "isError": True}
    raise LookupError(method)


def serve():
    # Keep the protocol on private copies of stdin/stdout and point fds 0-2 at
    # /dev/null: the browser that webbrowser.open starts inherits them, and it
    # must neither corrupt the JSON-RPC stream nor log the approval URL.
    rpc_in, rpc_out = os.fdopen(os.dup(0)), os.fdopen(os.dup(1), "w")
    devnull = os.open(os.devnull, os.O_RDWR)
    for fd in (0, 1, 2):
        os.dup2(devnull, fd)
    shop = Shop(Api())
    for line in rpc_in:
        try:
            message = json.loads(line)
            assert isinstance(message, dict) and isinstance(message.get("params", {}), dict)
        except (ValueError, AssertionError):
            print(json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}), file=rpc_out, flush=True)
            continue
        if "id" not in message:
            continue  # notifications need no reply
        try:
            reply = {"jsonrpc": "2.0", "id": message["id"], "result": handle(shop, message)}
        except LookupError:
            reply = {"jsonrpc": "2.0", "id": message["id"], "error": {"code": -32601, "message": "Method not found"}}
        print(json.dumps(reply), file=rpc_out, flush=True)


def self_test():
    class Fake:
        def __init__(self):
            self.calls = []

        def call(self, method, path, body=None):
            self.calls.append((method, path))
            if path == "/api/requests":
                return {"id": "r1", "version": 1, "status": "READY", "constraints": {}, "excluded": [],
                        "candidates": [{"id": "c1", "name": "Cloth", "specification": "40x40", "packs": 2, "individual_units": 40,
                                        "total_cents": 4760, "shipping_cents": 500, "tax_cents": 260}]}
            if path.endswith("/link"):
                return {"token": "SECRET-TOKEN"}
            return {"id": "r1", "version": 2, "status": "REVIEWED", "approval": None, "attempt": None,
                    "review": {"id": "v1", "total_cents": 4760, "currency": "USD", "expires_at": "soon",
                               "merchant": {"name": "Demo"}, "item": {"packs": 2, "name": "Cloth", "sku": "C"}}}

    opened = []
    webbrowser.open = lambda url: opened.append(url) or True
    shop = Shop(Fake())
    assert "$47.60" in handle(shop, {"method": "tools/call", "params": {"name": "find_offers", "arguments": {"request": "40 cloths"}}})["content"][0]["text"]
    handle(shop, {"method": "tools/call", "params": {"name": "prepare_cart", "arguments": {"offer_id": "c1"}}})
    sent = handle(shop, {"method": "tools/call", "params": {"name": "request_owner_approval", "arguments": {}}})["content"][0]["text"]
    assert opened == [f"{WEB}/?approve=SECRET-TOKEN"] and "SECRET" not in sent, "token must reach the browser, not the agent"
    names = {tool["name"] for tool in handle(shop, {"method": "tools/list"})["tools"]}
    assert not any(word in name for name in names for word in ("approve_cart", "pay", "capture")), "no paying tool"
    assert handle(shop, {"method": "tools/call", "params": {"name": "approve", "arguments": {}}})["isError"]
    print("ok")


if __name__ == "__main__":
    self_test() if sys.argv[1:] == ["--self-test"] else serve()
