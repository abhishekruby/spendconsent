"""Local-only settings. Private PayPal configuration is lazy and default-off."""
import hashlib
import os
from pathlib import Path
import secrets
import tempfile

ROOT = Path(__file__).resolve().parents[2]
private = ROOT / ".runtime/backend"
private.mkdir(mode=0o700, parents=True, exist_ok=True)
if private.is_symlink() or private.stat().st_uid != os.getuid() or private.stat().st_mode & 0o077:
    raise RuntimeError("Backend runtime directory must be private")
key_path = private / "django-secret-key"
try:
    descriptor = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
except FileExistsError:
    pass
else:
    with os.fdopen(descriptor, "w") as stream:
        stream.write(secrets.token_urlsafe(64))
if key_path.is_symlink() or key_path.stat().st_uid != os.getuid() or key_path.stat().st_mode & 0o077:
    raise RuntimeError("Django key must be a private runtime file")
SECRET_KEY = key_path.read_text()
DEBUG = False
ALLOWED_HOSTS = ["127.0.0.1", "localhost"]
CSRF_TRUSTED_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173"]
INSTALLED_APPS = ["django.contrib.sessions", "rest_framework", "purchases"]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
]
ROOT_URLCONF = "config.urls"
APPEND_SLASH = False
USE_TZ = True
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
DATABASES = {"default": {
    "ENGINE": "django.db.backends.postgresql", "NAME": "spendconsent", "USER": "spendconsent_app",
    "HOST": str(Path(tempfile.gettempdir()) / f"spendconsent-{os.getuid()}-{hashlib.sha256(str(ROOT).encode()).hexdigest()[:12]}"),
    "PORT": "55432", "CONN_MAX_AGE": 0, "OPTIONS": {"connect_timeout": 5},
    "TEST": {"NAME": "test_spendconsent"},
}}
SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_NAME = "spendconsent_session"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Strict"
CSRF_COOKIE_NAME = "spendconsent_csrf"
CSRF_COOKIE_SAMESITE = "Strict"
CSRF_FAILURE_VIEW = "purchases.views.csrf_failure"
DATA_UPLOAD_MAX_MEMORY_SIZE = 16384
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": [],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "UNAUTHENTICATED_USER": None,
    "EXCEPTION_HANDLER": "purchases.views.exception_handler",
}
# Public demo (compose.public.yaml): Django listens only on the private Docker
# network behind Caddy, which terminates HTTPS and sets X-Forwarded-Proto/-For.
PUBLIC_HOST = os.environ.get("SPENDCONSENT_PUBLIC_HOST", "")
if PUBLIC_HOST:
    ALLOWED_HOSTS.append(PUBLIC_HOST)
    CSRF_TRUSTED_ORIGINS.append(f"https://{PUBLIC_HOST}")
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = True
    REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = ["purchases.throttles.ActionThrottle"]
    REST_FRAMEWORK["NUM_PROXIES"] = 1
# Root may enable only after independent actual-model qualification. A matching
# private readiness marker is also required; no request can override either gate.
SPENDCONSENT_AI_ENABLED = os.environ.get("SPENDCONSENT_AI_ENABLED") == "1"
SPENDCONSENT_AI_READINESS = private / "ai-ready.json"
# The switch only permits configuration loading. An exact private action-time
# permission is still required at every real create/capture dispatch.
SPENDCONSENT_PAYPAL_ENABLED = os.environ.get("SPENDCONSENT_PAYPAL_ENABLED") == "1"
SPENDCONSENT_PAYPAL_CREDENTIALS = ROOT / ".env"
SPENDCONSENT_PAYPAL_PERMISSION = private / "paypal-permission.json"
# "buyer": the buyer's own in-app approval of the exact cart authorizes one
# sandbox order (judge/demo use). "operator" (default): a person must also write
# the one-time permission with `manage.py authorize_sandbox_purchase`.
SPENDCONSENT_PAYPAL_CONSENT = "buyer" if os.environ.get("SPENDCONSENT_PAYPAL_CONSENT") == "buyer" else "operator"
SPENDCONSENT_BUYER_MAX_CENTS = 10000
# Server logs contain no request bodies, private model/provider responses or local variables.
LOGGING = {"version": 1, "disable_existing_loggers": False,
           "handlers": {"null": {"class": "logging.NullHandler"}},
           "loggers": {"django.request": {"handlers": ["null"], "propagate": False},
                       "django.security": {"handlers": ["null"], "propagate": False},
                       # runserver access lines would contain approval-link bearer tokens.
                       "django.server": {"handlers": ["null"], "propagate": False}}}
