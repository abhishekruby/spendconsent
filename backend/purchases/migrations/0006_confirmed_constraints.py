"""Preserve human authority before any application AI results are enabled."""
from django.db import migrations, models
from django.db.models import F


def preserve_confirmed(apps, schema_editor):
    # Before this migration, every persisted constraint came from human input;
    # actual-model application integration was disabled.
    apps.get_model("purchases", "PurchaseRequest").objects.update(confirmed_constraints=F("constraints"))


class Migration(migrations.Migration):
    dependencies = [("purchases", "0005_attempt_authority")]
    operations = [
        migrations.AddField(model_name="purchaserequest", name="confirmed_constraints", field=models.JSONField(default=dict)),
        migrations.RunPython(preserve_confirmed, migrations.RunPython.noop),
    ]
