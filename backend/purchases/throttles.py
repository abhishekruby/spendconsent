# Its own module: DRF imports throttle classes while defining APIView, so this
# must not import rest_framework.views (directly or via purchases.views).
from rest_framework.throttling import AnonRateThrottle


class ActionThrottle(AnonRateThrottle):
    """Public hosting only: caps actions per visitor IP. Status polling stays free;
    the market check is a GET but spends the Channel3 key's quota, so it counts."""
    rate = "20/min"

    def allow_request(self, request, view):
        if request.method == "GET" and not request.path.endswith("/market"):
            return True
        return super().allow_request(request, view)
