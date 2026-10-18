from django.urls import path
from purchases import views

urlpatterns = [
    path("api/session", views.session),
    path("api/requests", views.requests),
    path("api/requests/<uuid:pk>", views.request_detail),
    path("api/requests/<uuid:pk>/clarify", views.clarify),
    path("api/requests/<uuid:pk>/reviews", views.reviews),
    path("api/reviews/<uuid:pk>/approve", views.approve),
    path("api/approvals/<uuid:pk>/attempts", views.start_attempt),
    path("api/attempts/<uuid:pk>", views.attempt_detail),
    path("api/attempts/<uuid:pk>/<str:action>", views.attempt_action),
]
handler400 = "purchases.views.bad_request"
handler403 = "purchases.views.forbidden"
handler404 = "purchases.views.not_found"
handler500 = "purchases.views.server_error"
