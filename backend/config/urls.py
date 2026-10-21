from django.urls import path
from purchases import views

urlpatterns = [
    path("api/session", views.session),
    path("api/requests", views.requests),
    path("api/progress", views.progress),
    path("api/purchases", views.purchases),
    path("api/requests/<uuid:pk>", views.request_detail),
    path("api/requests/<uuid:pk>/clarify", views.clarify),
    path("api/requests/<uuid:pk>/reviews", views.reviews),
    path("api/reviews/<uuid:pk>/approve", views.approve),
    path("api/reviews/<uuid:pk>/link", views.create_link),
    path("api/links/<str:token>", views.link_detail),
    path("api/links/<str:token>/approve", views.link_approve),
    path("api/links/<str:token>/attempts", views.link_start),
    path("api/links/<str:token>/attempt/<str:action>", views.link_attempt_action),
    path("api/approvals/<uuid:pk>/attempts", views.start_attempt),
    path("api/attempts/<uuid:pk>", views.attempt_detail),
    path("api/attempts/<uuid:pk>/<str:action>", views.attempt_action),
]
handler400 = "purchases.views.bad_request"
handler403 = "purchases.views.forbidden"
handler404 = "purchases.views.not_found"
handler500 = "purchases.views.server_error"
