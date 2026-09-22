from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ActivityLogViewSet,
    AttendanceViewSet,
    AuditLogViewSet,
    DepartmentViewSet,
    EmployeeViewSet,
    ErrorLogViewSet,
    LeaveRequestViewSet,
    MeView,
    StatsView,
    TaskViewSet,
    UserManagementViewSet,
)

router = DefaultRouter()

router.register(
    "departments",
    DepartmentViewSet,
    basename="department",
)

router.register(
    "employees",
    EmployeeViewSet,
    basename="employee",
)

router.register(
    "leave-requests",
    LeaveRequestViewSet,
    basename="leaverequest",
)

router.register(
    "users",
    UserManagementViewSet,
    basename="user-management",
)

router.register(
    "tasks",
    TaskViewSet,
    basename="task",
)

router.register(
    "attendance",
    AttendanceViewSet,
    basename="attendance",
)

router.register(
    "activity-logs",
    ActivityLogViewSet,
    basename="activitylog",
)

router.register(
    "audit-logs",
    AuditLogViewSet,
    basename="auditlog",
)

router.register(
    "error-logs",
    ErrorLogViewSet,
    basename="errorlog",
)

urlpatterns = [
    path(
        "stats/",
        StatsView.as_view(),
        name="stats",
    ),
    path(
        "me/",
        MeView.as_view(),
        name="me",
    ),
    path(
        "",
        include(router.urls),
    ),
]