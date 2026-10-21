import os
import sys
import threading
from django.apps import AppConfig
from django.conf import settings


class PurchasesConfig(AppConfig):
    name = "purchases"

    def ready(self):
        # Only the live server warms the model; tests and commands never call it.
        serving = sys.argv[1:2] == ["runserver"] and ("--noreload" in sys.argv or os.environ.get("RUN_MAIN") == "true")
        if serving and settings.SPENDCONSENT_AI_ENABLED:
            from . import inference
            threading.Thread(target=inference.warm, name="model-warmup", daemon=True).start()
