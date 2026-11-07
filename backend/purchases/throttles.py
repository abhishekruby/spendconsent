# Its own module: DRF imports throttle classes while defining APIView, so this
# must not import rest_framework.views (directly or via purchases.views).
from django.conf import settings
from rest_framework.throttling import AnonRateThrottle


class ActionThrottle(AnonRateThrottle):
    """Public hosting only: caps actions per visitor IP. Status polling stays free.
    Two GETs count: the market check (spends the Channel3 key's quota) and a
    session request without a cookie (it creates a stored session)."""
    rate = "20/min"

    def allow_request(self, request, view):
        new_session = request.path.endswith("/session") and settings.SESSION_COOKIE_NAME not in request.COOKIES
        if request.method == "GET" and not (request.path.endswith("/market") or new_session):
            return True
        return super().allow_request(request, view)
