"""Tidy a dictated request with the local model before the buyer sees it.

The model applies the speaker's own spoken corrections ("fifty, no, forty") and
drops fillers. The buyer reviews and can edit the result before any comparison,
and a result containing a number the speaker never said is rejected: tidying can
only remove numbers, never add them.
"""
import json
import re
import urllib.request
from . import agent, inference

SYSTEM = ("You tidy up a dictated shopping request. Apply the speaker's own spoken corrections "
          "(\"fifty, no wait, forty\" becomes \"forty\"; \"scratch that\" removes what came before it), "
          "remove filler words and false starts, and fix spacing and punctuation. Keep the speaker's "
          "wording and every quantity, size, price, unit and condition exactly as finally intended. "
          "Never add, guess or convert anything. Reply with the tidied request only.")
_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def numbers(text):
    digits = {float(item.replace(",", "")) for item in re.findall(r"\d[\d,]{0,15}(?:\.\d{1,6})?", text)}
    return digits | {float(item) for item in agent._number_words(text)}


def accepted(raw, tidied):
    return (bool(tidied) and len(tidied) <= len(raw) + 40 and "\n" not in tidied
            and numbers(tidied) <= numbers(raw))


def tidy(raw):
    """Returns {"text", "tidied"}; the raw words whenever the model is off or unsure."""
    if not inference.ready():
        return {"text": raw, "tidied": False}
    body = json.dumps({"model": agent.MODEL, "temperature": 0, "max_tokens": 300, "messages": [
        {"role": "system", "content": SYSTEM}, {"role": "user", "content": raw}]}).encode()
    request = urllib.request.Request(agent.ENDPOINT, body, {"Content-Type": "application/json"}, method="POST")
    try:
        with _OPENER.open(request, timeout=40) as response:
            content = json.loads(response.read(65536))["choices"][0]["message"]["content"]
        tidied = re.sub(r"<think>.*?</think>", "", content, flags=re.S).strip().strip('"“”').strip()
    except (OSError, ValueError, KeyError, IndexError, TypeError):
        return {"text": raw, "tidied": False}
    return {"text": tidied, "tidied": tidied != raw} if accepted(raw, tidied) else {"text": raw, "tidied": False}
