"""Enable actual AI only for the code a complete qualification report passed.

The report is local evidence written by scripts/ai_application_eval.py; this
operator command checks all gates passed and every backend source it hashed
(agent, catalog, models, serializers, seed) is unchanged.
ponytail: trusts the local report file; it is not a signature.
"""
import hashlib
import json
from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from purchases import agent
from .authorize_sandbox_purchase import write_private


class Command(BaseCommand):
    help = "Write the AI readiness marker from an all-gates-passed qualification report for the current adapter."

    def add_arguments(self, parser):
        parser.add_argument("report", type=Path)

    def handle(self, report, **options):
        try:
            data = json.loads(report.read_text())
            sources, model = data["checkpoint"]["sources"], data["checkpoint"]["configuration"]["model"]
            backend = {name: digest for name, digest in sources.items() if name.startswith("backend/")}
        except (OSError, ValueError, KeyError, TypeError, AttributeError):
            raise CommandError("Unreadable qualification report") from None
        adapter = hashlib.sha256(Path(agent.__file__).read_bytes()).hexdigest()
        if data.get("phase") != "complete" or data.get("all_gates_passed") is not True:
            raise CommandError("Report is not complete with all gates passed; AI stays off.")
        root = Path(settings.ROOT)
        if (backend.get("backend/purchases/agent.py") != adapter or model != agent.MODEL or any(
                not (root / name).is_file() or hashlib.sha256((root / name).read_bytes()).hexdigest() != digest
                for name, digest in backend.items())):
            raise CommandError("Report qualified different code or a different model; AI stays off.")
        write_private(Path(settings.SPENDCONSENT_AI_READINESS), {
            "schema_version": 1, "model": agent.MODEL, "qualified": True, "adapter_sha256": adapter})
        self.stdout.write(f"AI readiness granted for adapter {adapter[:12]} from {report.name}.")
