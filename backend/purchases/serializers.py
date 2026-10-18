from rest_framework import serializers


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError({"non_field_errors": ["Expected a JSON object."]})
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({"unknown_fields": sorted(unknown)})
        return super().to_internal_value(data)


class Integer(serializers.IntegerField):
    def to_internal_value(self, data):
        if type(data) is not int:
            raise serializers.ValidationError("Expected an integer.")
        return super().to_internal_value(data)


class Boolean(serializers.BooleanField):
    def to_internal_value(self, data):
        if type(data) is not bool:
            raise serializers.ValidationError("Expected a boolean.")
        return super().to_internal_value(data)


ATTRIBUTES = {"cloth": ("width_cm", "height_cm"), "bag": ("capacity_l",),
              "bottle": ("volume_ml",), "notebook": ("paper_size",)}


class Constraints(StrictSerializer):
    category = serializers.ChoiceField(choices=list(ATTRIBUTES), required=False)
    quantity = Integer(min_value=1, max_value=10000, required=False)
    budget_cents = Integer(min_value=1, max_value=1000000, required=False)
    currency = serializers.ChoiceField(choices=["USD"], required=False)
    one_time = Boolean(required=False)
    attributes = serializers.DictField(required=False)

    def validate(self, data):
        if "one_time" in data and data["one_time"] is not True:
            raise serializers.ValidationError({"one_time": "Only one-time purchases are supported."})
        attributes = data.get("attributes", {})
        category = data.get("category")
        if attributes and not category:
            raise serializers.ValidationError({"category": "Required when specifying attributes."})
        if category:
            if set(attributes) - set(ATTRIBUTES[category]):
                raise serializers.ValidationError({"attributes": "Unsupported specification fields."})
            for key, value in attributes.items():
                if key == "paper_size":
                    if value not in ("A4", "A5", "A6"):
                        raise serializers.ValidationError({"attributes": "Use A4, A5 or A6 paper size."})
                elif type(value) is not int or not 1 <= value <= 10000:
                    raise serializers.ValidationError({"attributes": "Measurements must be positive bounded integers."})
        return data


def missing_constraints(data):
    missing = [name for name in ("category", "quantity", "budget_cents", "currency", "one_time") if name not in data]
    if data.get("category") in ATTRIBUTES:
        missing.extend(f"attributes.{name}" for name in ATTRIBUTES[data["category"]]
                       if name not in data.get("attributes", {}))
    return missing


class CreateRequest(StrictSerializer):
    text = serializers.CharField(min_length=1, max_length=2000, trim_whitespace=False)
    client_submission_id = serializers.UUIDField()
    constraints = Constraints(required=False)

    def validate_text(self, value):
        if not isinstance(self.initial_data["text"], str) or not value.strip():
            raise serializers.ValidationError("Describe the supplies you need.")
        return value


class ClarifyRequest(StrictSerializer):
    expected_version = Integer(min_value=1)
    # Partial edits are merged with server-owned confirmed values under the request
    # lock, then the full Constraints schema validates the result before any write.
    constraints = serializers.DictField()


class CreateReview(StrictSerializer):
    expected_version = Integer(min_value=1)
    candidate_id = serializers.UUIDField()


class ApproveReview(StrictSerializer):
    expected_version = Integer(min_value=1)
    expected_digest = serializers.RegexField(r"\A[0-9a-f]{64}\Z")


class Empty(StrictSerializer):
    pass
