from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from core.views import LoginView, LogoutView

urlpatterns = [
    path("admin/", admin.site.urls),

    path(
        "api/auth/login/",
        LoginView.as_view(),
        name="token_obtain_pair",
    ),

    path(
        "api/auth/logout/",
        LogoutView.as_view(),
        name="logout",
    ),

    path(
        "api/auth/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh",
    ),

    path("api/", include("core.urls")),
]