"""Claim → unlocked actual comparison → version-checked persistence.

Only the team lead writes the private readiness marker after qualification. Test
fakes are confined to tests; the runtime always calls the actual-model adapter.
"""
import contextvars
import threading
from datetime import timedelta
import hashlib
import http.client
import io
import json
import os
from pathlib import Path
import stat
import time
import uuid
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from . import agent, services

# Live progress for the buyer's waiting screen: what the AI understood, recorded
# the moment the catalog tool returns, before the model's final confirmation.
# agent.py stays byte-identical (its hash gates AI readiness); this only observes.
# ponytail: in-process dict, so one API process (already a documented limit).
_PROGRESS = {}
_WARMING = threading.Lock()  # A buyer who arrives during warm-up waits instead of MODEL_BUSY.
_RECORDER = contextvars.ContextVar("spendconsent_progress", default=None)
_original_search = agent._search


def _observed_search(arguments, confirmed, text):
    result = _original_search(arguments, confirmed, text)
    record = _RECORDER.get()
    if record is not None:
        record(result)
    return result


agent._search = _observed_search


def progress(owner, pk):
    purchase = services.owned_request(owner, pk)
    if purchase.status != "COMPARING" or purchase.active_inference_id is None:
        return {"stage": "DONE"}
    return _PROGRESS.get(str(purchase.active_inference_id), {"stage": "READING"})


def warm(attempts=24):
    """Prime the model's prompt cache (system prompt + tool schema) at startup so
    the first buyer does not wait for the slow cold request."""
    for _ in range(attempts):
        if ready():
            with _WARMING:
                if agent._INFERENCE.acquire(blocking=False):
                    try:
                        # max_tokens 1 ends with finish_reason "length", which _chat rejects;
                        # that is expected — the prompt prefix is already cached by then.
                        agent._chat({"messages": [{"role": "system", "content": agent.SYSTEM}, {"role": "user", "content": "{}"}],
                                     "tools": [agent.TOOL], "tool_choice": "auto", "max_tokens": 1}, time.monotonic() + 60)
                    except Exception:  # A warm-up failure only means the first request is slower.
                        pass
                    finally:
                        agent._INFERENCE.release()
            return
        time.sleep(5)


def _healthy():
    deadline = time.monotonic() + 0.5

    class Response(http.client.HTTPResponse):
        def __init__(self, sock, *args, **kwargs):
            super().__init__(sock, *args, **kwargs)
            raw = sock.makefile("rb", buffering=0)
            self.fp.close()
            self.fp = io.BufferedReader(agent._DeadlineReader(raw, sock, deadline))

    transport = agent._DeadlineConnection(deadline)
    transport.response_class = Response
    try:
        transport.request("GET", "/health")
        response = transport.getresponse()
        try:
            raw = response.read(4097)
            return response.status == 200 and len(raw) <= 4096 and json.loads(raw) == {"status": "ok"}
        finally:
            response.close()
    except (agent.AgentError, OSError, http.client.HTTPException, ValueError):
        return False
    finally:
        transport.close()


def ready():
    if not settings.SPENDCONSENT_AI_ENABLED:
        return False
    marker = Path(settings.SPENDCONSENT_AI_READINESS)
    try:
        # The path is server configuration, never browser/model input. Reject
        # symlinked paths and files accessible by another local account.
        for path in (marker, marker.parent):
            info = path.stat()
            if path.is_symlink() or info.st_uid != os.getuid() or info.st_mode & 0o077:
                return False
        if marker.parent.parent.is_symlink() or not stat.S_ISREG(marker.stat().st_mode) or marker.stat().st_size > 4096:
            return False
        expected = {"schema_version": 1, "model": agent.MODEL, "qualified": True,
                    "adapter_sha256": hashlib.sha256(Path(agent.__file__).read_bytes()).hexdigest()}
        if json.loads(marker.read_text()) != expected:
            return False
    except (OSError, ValueError):
        return False
    return _healthy()


@transaction.atomic
def recover(owner, pk):
    purchase = services.owned_request(owner, pk, lock=True)
    if purchase.status == "COMPARING":
        started = purchase.events.filter(type="COMPARING").order_by("-created_at").first()
        if started is None or timezone.now() >= started.created_at + timedelta(seconds=95):
            purchase.status = "MODEL_ERROR"
            purchase.active_inference_id = None
            purchase.save(update_fields=["status", "active_inference_id"])
            services.event(purchase, "MODEL_ERROR", "Actual AI comparison timed out; confirm requirements to compare again.", "MODEL_TIMEOUT")
    return purchase


@transaction.atomic
def _finish(owner, pk, version, inference_id, result=None, error=None):
    purchase = services.owned_request(owner, pk, lock=True)
    if purchase.version != version or purchase.active_inference_id != inference_id or purchase.status != "COMPARING":
        return purchase
    purchase.active_inference_id = None
    if error:
        purchase.status = "MODEL_ERROR"
        services.event(purchase, "MODEL_ERROR", "Actual AI comparison failed; your request is saved and no payment was made.", error)
        fields = ["status", "active_inference_id"]
    else:
        fields = ["constraints", "status", "candidates", "excluded", "clarification", "model"]
        for field in fields:
            setattr(purchase, field, result[field])
        fields.append("active_inference_id")
        services.event(purchase, purchase.status, "Actual AI comparison completed using fictional catalog facts; buyer review is required.")
    purchase.save(update_fields=fields)
    return purchase


def compare(owner, purchase, inference_id):
    if inference_id is None or purchase.active_inference_id != inference_id:
        return recover(owner, purchase.id)
    key = str(inference_id)
    def record(result):
        _PROGRESS[key] = {"stage": "UNDERSTOOD", "constraints": result["constraints"],
                          "eligible": len(result["candidates"]), "status": result["status"]}
    if _WARMING.acquire(timeout=65):
        _WARMING.release()
    token = _RECORDER.set(record)
    try:
        try:
            result = agent.compare(purchase.text, purchase.confirmed_constraints)
        except agent.AgentError as error:
            code = error.code if error.code in ("MODEL_BUSY", "MODEL_TIMEOUT") else "MODEL_ERROR"
            return _finish(owner, purchase.id, purchase.version, inference_id, error=code)
        finally:
            _RECORDER.reset(token)
        return _finish(owner, purchase.id, purchase.version, inference_id, result=result)
    finally:
        # After the result is committed, so a poll never steps back to READING.
        _PROGRESS.pop(key, None)


def begin_submit(owner, data):
    inference_id = uuid.uuid4() if ready() else None
    purchase = services.submit(owner, data, inference_id=inference_id)
    return purchase, inference_id


def clarify(owner, pk, expected_version, constraints):
    inference_id = uuid.uuid4() if ready() else None
    purchase = services.clarify(owner, pk, expected_version, constraints, inference_id=inference_id)
    return compare(owner, purchase, inference_id)
