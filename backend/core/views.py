from datetime import timedelta
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from rest_framework import (
    filters,
    status,
    viewsets,
)

from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
)

from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
)

from .audit import (
    AuditLoggingMixin,
    log_action,
)

from .filters import (
    EmployeeFilter,
    LeaveRequestFilter,
)

from .models import (
    ActivityLog,
    AuditLog,
    Attendance,
    Department,
    Employee,
    ErrorLog,
    LeaveRequest,
    Task,
    UserProfile,
    Permission,
    RolePermission,
    UserPermissionOverride,
)

from .permissions import (
    HasEMSPermission,
    IsAdminOnly,
    IsAdminOrGeneralManager,
    has_ems_permission,
    role_of,
)

from .serializers import (
    ActivityLogSerializer,
    AuditLogSerializer,
    AttendanceSerializer,
    DepartmentSerializer,
    EmployeeSerializer,
    ErrorLogSerializer,
    LeaveRequestSerializer,
    LeaveReviewSerializer,
    PasswordResetSerializer,
    TaskSerializer,
    TaskStatusSerializer,
    UserCreateSerializer,
    UserManagementSerializer,
    PermissionSerializer,
    UserPermissionOverrideSerializer,
    UserPermissionsUpdateSerializer,
    effective_permission_codes,
)


# =========================================================
# CUSTOM PERMISSION HELPERS
# =========================================================
PERMISSION_CATALOG = [
    ("view_dashboard", "View Dashboard", "dashboard"),
    ("view_employee", "View Employees", "employees"),
    ("add_employee", "Add Employee", "employees"),
    ("edit_employee", "Edit Employee", "employees"),
    ("delete_employee", "Delete Employee", "employees"),
    ("view_department", "View Departments", "departments"),
    ("add_department", "Add Department", "departments"),
    ("edit_department", "Edit Department", "departments"),
    ("delete_department", "Delete Department", "departments"),
    ("view_attendance", "View Attendance", "attendance"),
    ("edit_attendance", "Edit Attendance", "attendance"),
    ("view_leave", "View Leave Requests", "leave"),
    ("create_leave", "Create Leave Request", "leave"),
    ("approve_leave", "Approve Leave Requests", "leave"),
    ("reject_leave", "Reject Leave Requests", "leave"),
    ("view_task", "View Tasks", "tasks"),
    ("add_task", "Create Tasks", "tasks"),
    ("edit_task", "Edit Tasks", "tasks"),
    ("delete_task", "Delete Tasks", "tasks"),
    ("assign_task", "Assign Tasks", "tasks"),
    ("view_user", "View Users", "users"),
    ("add_user", "Add Users", "users"),
    ("edit_user", "Edit Users", "users"),
    ("delete_user", "Delete Users", "users"),
    ("view_activity_log", "View Activity Log", "logs"),
    ("view_audit_log", "View Audit Log", "logs"),
    ("view_error_log", "View Error Log", "logs"),
]

ROLE_DEFAULTS = {
    UserProfile.Role.GENERAL_MANAGER: {
        code for code, _name, _module in PERMISSION_CATALOG
        if code != "view_error_log"
    },
    UserProfile.Role.DEPARTMENT_MANAGER: {
        "view_dashboard", "view_employee", "view_department",
        "view_attendance", "view_leave", "approve_leave",
        "reject_leave", "view_task",
    },
    UserProfile.Role.EMPLOYEE: {
        "view_dashboard", "view_employee", "view_department",
        "view_attendance", "view_leave", "create_leave",
        "view_task",
    },
}


def ensure_permission_catalog():
    """Create missing permission rows and role defaults without deleting data."""
    permission_map = {}
    for code, name, module in PERMISSION_CATALOG:
        permission, _created = Permission.objects.get_or_create(
            code=code,
            defaults={
                "name": name,
                "module": module,
                "description": "",
            },
        )
        permission_map[code] = permission

    for role, allowed_codes in ROLE_DEFAULTS.items():
        for code, permission in permission_map.items():
            RolePermission.objects.get_or_create(
                role=role,
                permission=permission,
                defaults={"allowed": code in allowed_codes},
            )

    return permission_map


# =========================================================
# ACTIVITY HELPER
# =========================================================
def add_activity(
    user,
    activity,
    details="",
):
    ActivityLog.objects.create(
        actor=(
            user
            if user
            and user.is_authenticated
            else None
        ),
        activity=activity,
        details=details[:500],
    )


# =========================================================
# ATTENDANCE HELPERS
# =========================================================
def employee_has_approved_leave(
    employee,
    attendance_date,
):
    return LeaveRequest.objects.filter(
        employee=employee,
        status=LeaveRequest.Status.APPROVED,
        start_date__lte=attendance_date,
        end_date__gte=attendance_date,
    ).exists()


def get_current_week_start(
    date_value=None,
):
    """
    Working week starts Saturday.

    Saturday = first day
    Friday   = Day Off
    """

    if date_value is None:
        date_value = timezone.localdate()

    # Python:
    # Monday 0
    # ...
    # Friday 4
    # Saturday 5
    # Sunday 6

    days_since_saturday = (
        date_value.weekday() - 5
    ) % 7

    return (
        date_value
        - timedelta(
            days=days_since_saturday
        )
    )


def ensure_employee_attendance(
    employee,
    attendance_date=None,
):
    """
    Create attendance record when required.

    Rules:
    Friday:
        Day Off

    Approved leave:
        On Leave

    Past working day without check-in:
        Absent

    Today after 4 PM without check-in:
        Absent

    Today before 4 PM without check-in:
        No record yet
    """

    if attendance_date is None:
        attendance_date = (
            timezone.localdate()
        )

    # -----------------------------------------
    # DO NOT CREATE BEFORE DATE HIRED
    # -----------------------------------------
    if (
        employee.date_hired
        and attendance_date
        < employee.date_hired
    ):
        return None

    # -----------------------------------------
    # INACTIVE EMPLOYEE
    # -----------------------------------------
    if (
        employee.status
        == Employee.Status.INACTIVE
    ):
        return None

    attendance = (
        Attendance.objects.filter(
            employee=employee,
            date=attendance_date,
        ).first()
    )

    # If actual check-in exists,
    # never overwrite it.
    if (
        attendance
        and attendance.check_in
    ):
        return attendance

    # -----------------------------------------
    # FRIDAY = DAY OFF
    # -----------------------------------------
    if Attendance.is_day_off(
        attendance_date
    ):
        if attendance:
            attendance.status = (
                Attendance.Status.DAY_OFF
            )

            attendance.save(
                update_fields=[
                    "status",
                    "updated_at",
                ]
            )

            return attendance

        return Attendance.objects.create(
            employee=employee,
            date=attendance_date,
            status=(
                Attendance.Status.DAY_OFF
            ),
        )

    # -----------------------------------------
    # APPROVED LEAVE
    # -----------------------------------------
    if employee_has_approved_leave(
        employee,
        attendance_date,
    ):
        if attendance:
            attendance.status = (
                Attendance.Status.ON_LEAVE
            )

            attendance.save(
                update_fields=[
                    "status",
                    "updated_at",
                ]
            )

            return attendance

        return Attendance.objects.create(
            employee=employee,
            date=attendance_date,
            status=(
                Attendance.Status.ON_LEAVE
            ),
        )

    today = timezone.localdate()

    # -----------------------------------------
    # PAST WORKING DAY = ABSENT
    # -----------------------------------------
    if attendance_date < today:
        if attendance:
            attendance.status = (
                Attendance.Status.ABSENT
            )

            attendance.save(
                update_fields=[
                    "status",
                    "updated_at",
                ]
            )

            return attendance

        return Attendance.objects.create(
            employee=employee,
            date=attendance_date,
            status=Attendance.Status.ABSENT,
        )

    # -----------------------------------------
    # TODAY AFTER 4 PM = ABSENT
    # -----------------------------------------
    if attendance_date == today:

        local_now = timezone.localtime(
            timezone.now()
        )

        if (
            local_now.time()
            >= Attendance.WORK_END_TIME
        ):
            if attendance:
                attendance.status = (
                    Attendance.Status.ABSENT
                )

                attendance.save(
                    update_fields=[
                        "status",
                        "updated_at",
                    ]
                )

                return attendance

            return Attendance.objects.create(
                employee=employee,
                date=attendance_date,
                status=(
                    Attendance.Status.ABSENT
                ),
            )

    return attendance


def sync_current_week_attendance(
    employee_queryset,
):
    """
    Creates missing records from Saturday
    through today.

    Example:
        Saturday  -> Present/Absent/etc
        Sunday    -> Present/Absent/etc
        Monday    -> Present/Absent/etc
        Tuesday   -> Present/Absent/etc
        Wednesday -> Present/Absent/etc
        Thursday  -> Present/Absent/etc
        Friday    -> Day Off
    """

    today = timezone.localdate()

    week_start = get_current_week_start(
        today
    )

    current_date = week_start

    employees = list(
        employee_queryset
    )

    while current_date <= today:

        for employee in employees:
            ensure_employee_attendance(
                employee,
                current_date,
            )

        current_date += timedelta(days=1)


# =========================================================
# LOGIN
# =========================================================
class LoginSerializer(
    TokenObtainPairSerializer
):

    def validate(self, attrs):
        data = super().validate(attrs)

        user = self.user

        add_activity(
            user,
            "Login",
            "User logged in successfully.",
        )

        # =====================================
        # AUTOMATIC CHECK-IN
        # =====================================
        employee = getattr(
            user,
            "employee_record",
            None,
        )

        # Admin / GM without Employee record
        if not employee:
            return data

        today = timezone.localdate()

        now = timezone.now()

        # -------------------------------------
        # FRIDAY = DAY OFF
        # -------------------------------------
        if Attendance.is_day_off(today):

            attendance, created = (
                Attendance.objects.get_or_create(
                    employee=employee,
                    date=today,
                    defaults={
                        "status":
                            Attendance.Status.DAY_OFF,
                    },
                )
            )

            if (
                not attendance.check_in
                and attendance.status
                != Attendance.Status.DAY_OFF
            ):
                attendance.status = (
                    Attendance.Status.DAY_OFF
                )

                attendance.save(
                    update_fields=[
                        "status",
                        "updated_at",
                    ]
                )

            return data

        # -------------------------------------
        # APPROVED LEAVE
        # -------------------------------------
        if employee_has_approved_leave(
            employee,
            today,
        ):
            attendance, created = (
                Attendance.objects.get_or_create(
                    employee=employee,
                    date=today,
                    defaults={
                        "status":
                            Attendance.Status.ON_LEAVE,
                    },
                )
            )

            if not attendance.check_in:
                attendance.status = (
                    Attendance.Status.ON_LEAVE
                )

                attendance.save(
                    update_fields=[
                        "status",
                        "updated_at",
                    ]
                )

            return data

        # -------------------------------------
        # GET TODAY RECORD
        # -------------------------------------
        attendance = (
            Attendance.objects.filter(
                employee=employee,
                date=today,
            ).first()
        )

        # -------------------------------------
        # ALREADY CHECKED IN
        #
        # Do not change first check-in.
        # -------------------------------------
        if (
            attendance
            and attendance.check_in
        ):
            return data

        attendance_status = (
            Attendance.get_check_in_status(
                now
            )
        )

        # -------------------------------------
        # RECORD MAY ALREADY BE ABSENT
        #
        # If employee now logs in,
        # they are Late instead of Absent.
        # -------------------------------------
        if attendance:

            attendance.check_in = now

            attendance.status = (
                attendance_status
            )

            attendance.save(
                update_fields=[
                    "check_in",
                    "status",
                    "updated_at",
                ]
            )

        else:

            attendance = (
                Attendance.objects.create(
                    employee=employee,
                    date=today,
                    check_in=now,
                    status=attendance_status,
                )
            )

        local_time = timezone.localtime(
            now
        )

        # -------------------------------------
        # ACTIVITY LOG
        # -------------------------------------
        if (
            attendance_status
            == Attendance.Status.LATE
        ):
            add_activity(
                user,
                "Attendance Late Check In",
                (
                    "Late automatic check-in at "
                    f"{local_time.strftime('%I:%M %p')}."
                ),
            )

        else:
            add_activity(
                user,
                "Attendance Check In",
                (
                    "Automatic check-in at "
                    f"{local_time.strftime('%I:%M %p')}."
                ),
            )

        return data


class LoginView(
    TokenObtainPairView
):
    serializer_class = LoginSerializer


# =========================================================
# LOGOUT
# =========================================================
class LogoutView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    def post(self, request):

        add_activity(
            request.user,
            "Logout",
            "User logged out.",
        )

        return Response({
            "detail":
                "Logged out successfully."
        })


# =========================================================
# DEPARTMENTS
# =========================================================
class DepartmentViewSet(
    AuditLoggingMixin,
    viewsets.ModelViewSet,
):
    serializer_class = (
        DepartmentSerializer
    )

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "name",
        "description",
    ]

    ordering_fields = [
        "name",
        "created_at",
        "employee_count",
    ]

    def get_permissions(self):
        permission_map = {
            "list": "view_department",
            "retrieve": "view_department",
            "create": "add_department",
            "update": "edit_department",
            "partial_update": "edit_department",
            "destroy": "delete_department",
        }

        self.required_permission = permission_map.get(
            self.action,
            "view_department",
        )

        return [
            IsAuthenticated(),
            HasEMSPermission(),
        ]

    def get_queryset(self):

        qs = (
            Department.objects
            .annotate(
                employee_count=Count(
                    "employees"
                )
            )
            .all()
        )

        role = role_of(
            self.request.user
        )

        if role in {
            UserProfile.Role.ADMIN,
            UserProfile.Role.GENERAL_MANAGER,
        }:
            return qs

        if role in {
            UserProfile.Role.DEPARTMENT_MANAGER,
            UserProfile.Role.EMPLOYEE,
        }:
            has_department_management_permission = (
                has_ems_permission(
                    self.request.user,
                    "add_department",
                )
                or has_ems_permission(
                    self.request.user,
                    "edit_department",
                )
                or has_ems_permission(
                    self.request.user,
                    "delete_department",
                )
            )

            if has_department_management_permission:
                return qs

            profile = getattr(
                self.request.user,
                "ems_profile",
                None,
            )

            if (
                profile
                and profile.department_id
            ):
                return qs.filter(
                    pk=profile.department_id
                )

            return qs.none()

        return qs.none()


# =========================================================
# EMPLOYEES
# =========================================================
class EmployeeViewSet(
    AuditLoggingMixin,
    viewsets.ModelViewSet,
):
    serializer_class = (
        EmployeeSerializer
    )

    queryset = (
        Employee.objects
        .select_related(
            "department",
            "user",
        )
        .all()
    )

    filterset_class = EmployeeFilter

    search_fields = [
        "first_name",
        "last_name",
        "email",
        "job_title",
    ]

    ordering_fields = [
        "last_name",
        "first_name",
        "date_hired",
        "created_at",
        "status",
    ]

    def get_permissions(self):
        permission_map = {
            "list": "view_employee",
            "retrieve": "view_employee",
            "create": "add_employee",
            "update": "edit_employee",
            "partial_update": "edit_employee",
            "destroy": "delete_employee",
        }

        self.required_permission = permission_map.get(
            self.action,
            "view_employee",
        )

        return [
            IsAuthenticated(),
            HasEMSPermission(),
        ]

    def get_queryset(self):

        qs = (
            Employee.objects
            .select_related(
                "department",
                "user",
            )
            .all()
        )

        role = role_of(
            self.request.user
        )

        if role in {
            UserProfile.Role.ADMIN,
            UserProfile.Role.GENERAL_MANAGER,
        }:
            return qs

        if (
            role
            == UserProfile.Role.DEPARTMENT_MANAGER
        ):
            profile = getattr(
                self.request.user,
                "ems_profile",
                None,
            )

            if (
                profile
                and profile.department_id
            ):
                return qs.filter(
                    department_id=
                        profile.department_id
                )

            return qs.none()

        if (
            role
            == UserProfile.Role.EMPLOYEE
        ):
            has_employee_management_permission = (
                has_ems_permission(
                    self.request.user,
                    "add_employee",
                )
                or has_ems_permission(
                    self.request.user,
                    "edit_employee",
                )
                or has_ems_permission(
                    self.request.user,
                    "delete_employee",
                )
            )

            if has_employee_management_permission:
                return qs

            return qs.filter(
                user=self.request.user
            )

        return qs.none()


# =========================================================
# ATTENDANCE
# =========================================================
class AttendanceViewSet(
    viewsets.ReadOnlyModelViewSet
):
    serializer_class = (
        AttendanceSerializer
    )

    permission_classes = [
        IsAuthenticated,
    ]

    def get_permissions(self):
        # Employees must always be able to access their OWN attendance,
        # including today's record and check-out, even when the
        # view_attendance permission is disabled.
        #
        # Security is still enforced by get_queryset(), which limits
        # Employee role users to their own attendance records only.
        if (
            self.request.user.is_authenticated
            and role_of(self.request.user)
            == UserProfile.Role.EMPLOYEE
        ):
            return [
                IsAuthenticated(),
            ]

        # All other non-admin roles still require view_attendance.
        # Admin / Superuser is allowed by HasEMSPermission.
        self.required_permission = "view_attendance"

        return [
            IsAuthenticated(),
            HasEMSPermission(),
        ]

    # -----------------------------------------------------
    # EMPLOYEES CURRENT USER CAN SEE
    # -----------------------------------------------------
    def get_employee_queryset(self):

        user = self.request.user

        role = role_of(user)

        qs = (
            Employee.objects
            .select_related(
                "department",
                "user",
            )
            .all()
        )

        if role in {
            UserProfile.Role.ADMIN,
            UserProfile.Role.GENERAL_MANAGER,
        }:
            return qs

        if (
            role
            == UserProfile.Role.DEPARTMENT_MANAGER
        ):
            profile = getattr(
                user,
                "ems_profile",
                None,
            )

            if (
                profile
                and profile.department_id
            ):
                return qs.filter(
                    department_id=
                        profile.department_id
                )

            return qs.none()

        if (
            role
            == UserProfile.Role.EMPLOYEE
        ):
            return qs.filter(
                user=user
            )

        return qs.none()

    # -----------------------------------------------------
    # ATTENDANCE QUERYSET
    # -----------------------------------------------------
    def get_queryset(self):

        user = self.request.user

        role = role_of(user)

        employee_qs = (
            self.get_employee_queryset()
        )

        # Automatically fill missing records
        # for current week.
        sync_current_week_attendance(
            employee_qs
        )

        qs = (
            Attendance.objects
            .select_related(
                "employee",
                "employee__department",
                "employee__user",
            )
            .all()
        )

        if role in {
            UserProfile.Role.ADMIN,
            UserProfile.Role.GENERAL_MANAGER,
        }:
            return qs

        if (
            role
            == UserProfile.Role.DEPARTMENT_MANAGER
        ):
            profile = getattr(
                user,
                "ems_profile",
                None,
            )

            if (
                profile
                and profile.department_id
            ):
                return qs.filter(
                    employee__department_id=
                        profile.department_id
                )

            return qs.none()

        if (
            role
            == UserProfile.Role.EMPLOYEE
        ):
            employee = getattr(
                user,
                "employee_record",
                None,
            )

            if employee:
                return qs.filter(
                    employee=employee
                )

            return qs.none()

        return qs.none()

    # -----------------------------------------------------
    # TODAY
    # -----------------------------------------------------
    @action(
        detail=False,
        methods=["get"],
        url_path="today",
    )
    def today(
        self,
        request,
    ):
        employee = getattr(
            request.user,
            "employee_record",
            None,
        )

        if not employee:
            return Response({
                "attendance": None,
                "checked_in": False,
                "checked_out": False,
            })

        today = timezone.localdate()

        ensure_employee_attendance(
            employee,
            today,
        )

        attendance = (
            Attendance.objects
            .filter(
                employee=employee,
                date=today,
            )
            .first()
        )

        if not attendance:
            return Response({
                "attendance": None,
                "checked_in": False,
                "checked_out": False,
            })

        return Response({
            "attendance":
                AttendanceSerializer(
                    attendance,
                    context={
                        "request": request,
                    },
                ).data,

            "checked_in":
                bool(
                    attendance.check_in
                ),

            "checked_out":
                bool(
                    attendance.check_out
                ),
        })

    # -----------------------------------------------------
    # CHECK OUT
    # -----------------------------------------------------
    @action(
        detail=False,
        methods=["post"],
        url_path="check-out",
    )
    def check_out(
        self,
        request,
    ):
        employee = getattr(
            request.user,
            "employee_record",
            None,
        )

        if not employee:
            return Response(
                {
                    "detail":
                        "No employee record "
                        "is linked to this account."
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        attendance = (
            Attendance.objects
            .filter(
                employee=employee,
                date=timezone.localdate(),
            )
            .first()
        )

        if (
            not attendance
            or not attendance.check_in
        ):
            return Response(
                {
                    "detail":
                        "You have not "
                        "checked in today."
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        if attendance.check_out:
            return Response({
                "detail":
                    "You have already "
                    "checked out today.",

                "attendance":
                    AttendanceSerializer(
                        attendance,
                        context={
                            "request": request,
                        },
                    ).data,
            })

        attendance.check_out = (
            timezone.now()
        )

        attendance.save(
            update_fields=[
                "check_out",
                "updated_at",
            ]
        )

        add_activity(
            request.user,
            "Attendance Check Out",
            (
                "Checked out at "
                f"{timezone.localtime(attendance.check_out).strftime('%I:%M %p')}."
            ),
        )

        return Response({
            "detail":
                "Checked out successfully.",

            "attendance":
                AttendanceSerializer(
                    attendance,
                    context={
                        "request": request,
                    },
                ).data,
        })


# =========================================================
# LEAVE REQUESTS
# =========================================================
class LeaveRequestViewSet(
    AuditLoggingMixin,
    viewsets.ModelViewSet,
):
    serializer_class = (
        LeaveRequestSerializer
    )

    permission_classes = [
        IsAuthenticated,
    ]

    def get_permissions(self):
        permission_map = {
            "list": "view_leave",
            "retrieve": "view_leave",
            "create": "create_leave",
            "approve": "approve_leave",
            "reject": "reject_leave",
            "eligible_employees": "view_leave",
            # There is currently no edit_leave or delete_leave
            # permission in the permission catalog.
            #
            # Do NOT map update/delete to create_leave because
            # permission to create a request must not automatically
            # grant permission to edit or delete requests.
        }

        if self.action in {
            "update",
            "partial_update",
            "destroy",
        }:
            return [
                IsAuthenticated(),
                IsAdminOrGeneralManager(),
            ]

        self.required_permission = permission_map.get(
            self.action,
            "view_leave",
        )

        return [
            IsAuthenticated(),
            HasEMSPermission(),
        ]

    queryset = (
        LeaveRequest.objects
        .select_related(
            "employee",
            "employee__department",
            "reviewed_by",
        )
        .all()
    )

    filterset_class = (
        LeaveRequestFilter
    )

    search_fields = [
        "employee__first_name",
        "employee__last_name",
        "reason",
    ]

    ordering_fields = [
        "start_date",
        "end_date",
        "created_at",
        "status",
    ]

    def get_queryset(self):

        qs = (
            LeaveRequest.objects
            .select_related(
                "employee",
                "employee__department",
                "reviewed_by",
            )
            .all()
        )

        role = role_of(
            self.request.user
        )

        if role in {
            UserProfile.Role.ADMIN,
            UserProfile.Role.GENERAL_MANAGER,
        }:
            return qs

        if (
            role
            == UserProfile.Role.DEPARTMENT_MANAGER
        ):
            profile = getattr(
                self.request.user,
                "ems_profile",
                None,
            )

            if (
                profile
                and profile.department_id
            ):
                return qs.filter(
                    employee__department_id=
                        profile.department_id
                )

            return qs.none()

        if (
            role
            == UserProfile.Role.EMPLOYEE
        ):
            has_leave_management_permission = (
                has_ems_permission(
                    self.request.user,
                    "approve_leave",
                )
                or has_ems_permission(
                    self.request.user,
                    "reject_leave",
                )
            )

            if has_leave_management_permission:
                return qs

            return qs.filter(
                employee__user=
                    self.request.user
            )

        return qs.none()

    def perform_create(
        self,
        serializer,
    ):
        if (
            role_of(self.request.user)
            == UserProfile.Role.EMPLOYEE
        ):
            employee = (
                Employee.objects
                .filter(user=self.request.user)
                .first()
            )

            if not employee:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({
                    "employee": "No employee profile is linked to this account."
                })

            # Employee can only create their own leave request.
            instance = serializer.save(employee=employee)
        else:
            instance = serializer.save()

        log_action(
            self.request,
            AuditLog.Action.CREATE,
            instance,
            serializer.validated_data,
        )

        add_activity(
            self.request.user,
            "Leave request created",
            str(instance),
        )

    @action(
        detail=False,
        methods=["get"],
        url_path="eligible-employees",
    )
    def eligible_employees(
        self,
        request,
    ):
        """
        Minimal employee picker for Leave management only.

        It intentionally exposes only the fields needed to select
        a leave-request owner. It does NOT grant EmployeeViewSet
        access or employee profile access.
        """
        if not (
            has_ems_permission(request.user, "approve_leave")
            or has_ems_permission(request.user, "reject_leave")
        ):
            return Response(
                {"detail": "Leave management permission is required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        employees = (
            Employee.objects
            .select_related("department")
            .all()
            .order_by("last_name", "first_name")
        )

        rows = [
            {
                "id": employee.id,
                "full_name": employee.full_name,
                "department_name": (
                    employee.department.name
                    if employee.department
                    else ""
                ),
            }
            for employee in employees
        ]

        return Response(rows)

    @action(
        detail=True,
        methods=["post"],
    )
    def approve(
        self,
        request,
        pk=None,
    ):
        return self._review(
            request,
            pk,
            LeaveRequest.Status.APPROVED,
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def reject(
        self,
        request,
        pk=None,
    ):
        return self._review(
            request,
            pk,
            LeaveRequest.Status.REJECTED,
        )

    def _review(
        self,
        request,
        pk,
        new_status,
    ):
        required_code = (
            "approve_leave"
            if new_status == LeaveRequest.Status.APPROVED
            else "reject_leave"
        )

        if not has_ems_permission(
            request.user,
            required_code,
        ):
            return Response(
                {
                    "detail":
                        "You do not have permission "
                        "to review this leave request."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        leave = self.get_object()

        if (
            leave.status
            != LeaveRequest.Status.PENDING
        ):
            return Response(
                {
                    "detail":
                        "Only pending leave "
                        "requests can be reviewed."
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        serializer = (
            LeaveReviewSerializer(
                data=request.data
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        leave.status = new_status

        leave.reviewed_by = (
            request.user
        )

        leave.review_note = (
            serializer.validated_data.get(
                "review_note",
                "",
            )
        )

        leave.save()

        if (
            new_status
            == LeaveRequest.Status.APPROVED
        ):
            employee = leave.employee

            employee.leave_balance = max(
                0,
                employee.leave_balance
                - leave.days_requested,
            )

            employee.save(
                update_fields=[
                    "leave_balance",
                ]
            )

            # Update any attendance records
            # already created for leave dates.
            current_date = leave.start_date

            today = timezone.localdate()

            while (
                current_date
                <= leave.end_date
                and current_date <= today
            ):

                if not Attendance.is_day_off(
                    current_date
                ):
                    attendance = (
                        Attendance.objects
                        .filter(
                            employee=employee,
                            date=current_date,
                            check_in__isnull=True,
                        )
                        .first()
                    )

                    if attendance:
                        attendance.status = (
                            Attendance.Status.ON_LEAVE
                        )

                        attendance.save(
                            update_fields=[
                                "status",
                                "updated_at",
                            ]
                        )

                current_date += timedelta(
                    days=1
                )

        audit_action = (
            AuditLog.Action.APPROVE
            if new_status
            == LeaveRequest.Status.APPROVED
            else AuditLog.Action.REJECT
        )

        log_action(
            request,
            audit_action,
            leave,
            {
                "review_note":
                    leave.review_note
            },
        )

        add_activity(
            request.user,
            f"Leave request {new_status}",
            str(leave),
        )

        return Response(
            LeaveRequestSerializer(
                leave
            ).data
        )


# =========================================================
# USER MANAGEMENT
# =========================================================
class UserManagementViewSet(
    viewsets.ModelViewSet
):
    serializer_class = (
        UserManagementSerializer
    )

    permission_classes = [
        IsAuthenticated,
    ]

    def get_permissions(self):
        # Grant/Revoke endpoints remain Admin-only inside their methods.
        permission_map = {
            "list": "view_user",
            "retrieve": "view_user",
            "create_user": "add_user",
            "reset_password": "edit_user",
            "destroy": "delete_user",
            "permissions_catalog": "view_user",
            "permissions": "view_user",
            "reset_permissions": "view_user",
        }

        if self.action in {"create", "update", "partial_update"}:
            return [
                IsAuthenticated(),
                IsAdminOnly(),
            ]

        self.required_permission = permission_map.get(
            self.action,
            "view_user",
        )

        return [
            IsAuthenticated(),
            HasEMSPermission(),
        ]

    queryset = (
        User.objects
        .select_related(
            "ems_profile",
            "ems_profile__department",
        )
        .exclude(
            is_superuser=True
        )
        .order_by(
            "username"
        )
    )

    search_fields = [
        "username",
        "first_name",
        "last_name",
        "email",
    ]

    def destroy(self, request, *args, **kwargs):
        target_user = self.get_object()

        if target_user.pk == request.user.pk:
            return Response(
                {"detail": "You cannot delete your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = target_user.username

        log_action(
            request,
            AuditLog.Action.DELETE,
            target_user,
            {"username": username},
        )

        add_activity(
            request.user,
            "User account deleted",
            username,
        )

        target_user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=False,
        methods=["post"],
        url_path="create-user",
    )
    def create_user(
        self,
        request,
    ):
        serializer = (
            UserCreateSerializer(
                data=request.data
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        if (
            serializer.validated_data["role"]
            == UserProfile.Role.GENERAL_MANAGER
            and role_of(request.user)
            != UserProfile.Role.ADMIN
        ):
            return Response(
                {
                    "role": [
                        "Only Admin can create "
                        "a General Manager account."
                    ]
                },
                status=403,
            )

        with transaction.atomic():

            user = serializer.save()

            add_activity(
                request.user,
                "User account created",
                (
                    f"{user.username} "
                    f"({user.ems_profile.get_role_display()})"
                ),
            )

            log_action(
                request,
                AuditLog.Action.CREATE,
                user,
                {
                    "role":
                        user.ems_profile.role,

                    "department":
                        user.ems_profile.department_id,
                },
            )

        return Response(
            UserManagementSerializer(
                user
            ).data,
            status=201,
        )

    @action(
        detail=False,
        methods=["get"],
        url_path="permissions-catalog",
    )
    def permissions_catalog(self, request):
        if role_of(request.user) != UserProfile.Role.ADMIN:
            return Response(
                {"detail": "Only Admin can manage permissions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        ensure_permission_catalog()
        permissions = Permission.objects.all().order_by("module", "name")
        return Response(PermissionSerializer(permissions, many=True).data)

    @action(
        detail=True,
        methods=["get", "patch"],
        url_path="permissions",
    )
    def permissions(self, request, pk=None):
        if role_of(request.user) != UserProfile.Role.ADMIN:
            return Response(
                {"detail": "Only Admin can manage permissions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        ensure_permission_catalog()
        target_user = self.get_object()

        if request.method == "GET":
            profile = getattr(target_user, "ems_profile", None)
            role = profile.role if profile else None

            defaults = set(
                RolePermission.objects.filter(
                    role=role,
                    allowed=True,
                ).values_list("permission__code", flat=True)
            ) if role else set()

            overrides = UserPermissionOverride.objects.filter(
                user=target_user
            ).select_related("permission", "granted_by")

            return Response({
                "user": UserManagementSerializer(target_user).data,
                "role": role,
                "default_permissions": sorted(defaults),
                "effective_permissions": effective_permission_codes(target_user),
                "overrides": UserPermissionOverrideSerializer(
                    overrides, many=True
                ).data,
            })

        serializer = UserPermissionsUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            for item in serializer.validated_data["permissions"]:
                permission = item["permission"]
                allowed = item["allowed"]

                UserPermissionOverride.objects.update_or_create(
                    user=target_user,
                    permission=permission,
                    defaults={
                        "allowed": allowed,
                        "granted_by": request.user,
                    },
                )

                add_activity(
                    request.user,
                    "Permission updated",
                    f"{target_user.username}: {permission.code} = {allowed}",
                )

        return Response({
            "detail": "Permissions updated successfully.",
            "effective_permissions": effective_permission_codes(target_user),
        })

    @action(
        detail=True,
        methods=["post"],
        url_path="reset-permissions",
    )
    def reset_permissions(self, request, pk=None):
        if role_of(request.user) != UserProfile.Role.ADMIN:
            return Response(
                {"detail": "Only Admin can manage permissions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        target_user = self.get_object()
        deleted, _ = UserPermissionOverride.objects.filter(
            user=target_user
        ).delete()

        add_activity(
            request.user,
            "Permissions reset",
            f"{target_user.username}: reset to role defaults.",
        )

        return Response({
            "detail": "Permissions reset to role defaults.",
            "removed_overrides": deleted,
            "effective_permissions": effective_permission_codes(target_user),
        })

    @action(
        detail=True,
        methods=["post"],
        url_path="reset-password",
    )
    def reset_password(
        self,
        request,
        pk=None,
    ):
        user = self.get_object()

        serializer = (
            PasswordResetSerializer(
                data=request.data
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        user.set_password(
            serializer.validated_data[
                "new_password"
            ]
        )

        user.save(
            update_fields=[
                "password",
            ]
        )

        if hasattr(
            user,
            "ems_profile",
        ):
            user.ems_profile.must_change_password = (
                True
            )

            user.ems_profile.save(
                update_fields=[
                    "must_change_password",
                ]
            )

        add_activity(
            request.user,
            "Password reset",
            (
                f"Password reset for "
                f"{user.username}"
            ),
        )

        log_action(
            request,
            AuditLog.Action.UPDATE,
            user,
            {
                "password": "reset"
            },
        )

        return Response({
            "detail":
                "Password reset successfully."
        })


# =========================================================
# TASKS
# =========================================================
class TaskViewSet(
    AuditLoggingMixin,
    viewsets.ModelViewSet,
):
    serializer_class = (
        TaskSerializer
    )

    permission_classes = [
        IsAuthenticated,
    ]

    def get_permissions(self):
        permission_map = {
            "list": "view_task",
            "retrieve": "view_task",
            "create": "add_task",
            "update": "edit_task",
            "partial_update": "edit_task",
            "destroy": "delete_task",
            "set_status": "view_task",
        }

        self.required_permission = permission_map.get(
            self.action,
            "view_task",
        )

        return [
            IsAuthenticated(),
            HasEMSPermission(),
        ]

    filterset_fields = [
        "department",
        "priority",
        "status",
    ]

    search_fields = [
        "title",
        "description",
        "department__name",
    ]

    ordering_fields = [
        "created_at",
        "due_date",
        "priority",
        "status",
    ]

    def get_queryset(self):

        qs = (
            Task.objects
            .select_related(
                "department",
                "created_by",
                "last_updated_by",
            )
            .all()
        )

        role = role_of(
            self.request.user
        )

        if role in {
            UserProfile.Role.ADMIN,
            UserProfile.Role.GENERAL_MANAGER,
        }:
            return qs

        if role in {
            UserProfile.Role.DEPARTMENT_MANAGER,
            UserProfile.Role.EMPLOYEE,
        }:
            has_task_management_permission = (
                has_ems_permission(
                    self.request.user,
                    "add_task",
                )
                or has_ems_permission(
                    self.request.user,
                    "edit_task",
                )
                or has_ems_permission(
                    self.request.user,
                    "delete_task",
                )
                or has_ems_permission(
                    self.request.user,
                    "assign_task",
                )
            )

            if has_task_management_permission:
                return qs

            profile = getattr(
                self.request.user,
                "ems_profile",
                None,
            )

            if (
                profile
                and profile.department_id
            ):
                return qs.filter(
                    department_id=profile.department_id
                )

            # Employee fallback: use the linked Employee department
            # when UserProfile.department is not populated.
            if role == UserProfile.Role.EMPLOYEE:
                employee = getattr(
                    self.request.user,
                    "employee_record",
                    None,
                )

                if (
                    employee
                    and employee.department_id
                ):
                    return qs.filter(
                        department_id=employee.department_id
                    )

            return qs.none()

        return qs.none()

    def create(
        self,
        request,
        *args,
        **kwargs,
    ):
        if not has_ems_permission(request.user, "add_task"):
            return Response(
                {"detail": "You do not have permission to create tasks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().create(
            request,
            *args,
            **kwargs,
        )

    def perform_create(
        self,
        serializer,
    ):
        instance = serializer.save(
            created_by=self.request.user,
            last_updated_by=
                self.request.user,
        )

        log_action(
            self.request,
            AuditLog.Action.CREATE,
            instance,
            serializer.validated_data,
        )

        add_activity(
            self.request.user,
            "Department task created",
            (
                f"{instance.title} → "
                f"{instance.department.name} "
                f"({instance.priority})"
            ),
        )

    def update(
        self,
        request,
        *args,
        **kwargs,
    ):
        if not has_ems_permission(request.user, "edit_task"):
            return Response(
                {"detail": "You do not have permission to edit tasks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().update(
            request,
            *args,
            **kwargs,
        )

    def perform_update(
        self,
        serializer,
    ):
        instance = serializer.save(
            last_updated_by=
                self.request.user
        )

        log_action(
            self.request,
            AuditLog.Action.UPDATE,
            instance,
            serializer.validated_data,
        )

        add_activity(
            self.request.user,
            "Department task updated",
            instance.title,
        )

    def destroy(
        self,
        request,
        *args,
        **kwargs,
    ):
        if not has_ems_permission(request.user, "delete_task"):
            return Response(
                {"detail": "You do not have permission to delete tasks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().destroy(
            request,
            *args,
            **kwargs,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="set-status",
    )
    def set_status(
        self,
        request,
        pk=None,
    ):
        task = self.get_object()

        serializer = (
            TaskStatusSerializer(
                data=request.data
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        old_status = task.status

        task.status = (
            serializer.validated_data[
                "status"
            ]
        )

        task.last_updated_by = (
            request.user
        )

        task.save(
            update_fields=[
                "status",
                "last_updated_by",
                "updated_at",
            ]
        )

        log_action(
            request,
            AuditLog.Action.UPDATE,
            task,
            {
                "status": task.status
            },
        )

        add_activity(
            request.user,
            "Task progress updated",
            (
                f"{task.title}: "
                f"{old_status} → "
                f"{task.status}"
            ),
        )

        return Response(
            TaskSerializer(task).data
        )


# =========================================================
# DASHBOARD STATS
# =========================================================
class StatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not has_ems_permission(request.user, "view_dashboard"):
            return Response(
                {"detail": "You do not have permission to view the dashboard."},
                status=status.HTTP_403_FORBIDDEN,
            )
        today = timezone.localdate()
        role = role_of(request.user)
        profile = getattr(request.user, "ems_profile", None)

        employee_qs = Employee.objects.all()
        department_qs = Department.objects.all()
        leave_qs = LeaveRequest.objects.all()
        task_qs = Task.objects.all()
        attendance_qs = Attendance.objects.filter(date=today)

        dashboard_scope = "company"
        employee_profile = None

        # Admin / General Manager: company-wide scope.
        if role in {
            UserProfile.Role.ADMIN,
            UserProfile.Role.GENERAL_MANAGER,
        }:
            sync_current_week_attendance(employee_qs)
            attendance_qs = Attendance.objects.filter(date=today)

        # Department Manager: assigned department only.
        elif role == UserProfile.Role.DEPARTMENT_MANAGER:
            dashboard_scope = "department"

            if profile and profile.department_id:
                employee_qs = employee_qs.filter(
                    department_id=profile.department_id
                )
                department_qs = department_qs.filter(
                    pk=profile.department_id
                )
                leave_qs = leave_qs.filter(
                    employee__department_id=profile.department_id
                )
                task_qs = task_qs.filter(
                    department_id=profile.department_id
                )

                sync_current_week_attendance(employee_qs)

                attendance_qs = Attendance.objects.filter(
                    date=today,
                    employee__department_id=profile.department_id,
                )
            else:
                employee_qs = employee_qs.none()
                department_qs = department_qs.none()
                leave_qs = leave_qs.none()
                task_qs = task_qs.none()
                attendance_qs = attendance_qs.none()

        # Employee:
        # - If all management permissions needed by the dashboard are granted,
        #   show company-wide dashboard statistics.
        # - Otherwise preserve the normal personal dashboard scope.
        elif role == UserProfile.Role.EMPLOYEE:
            has_full_dashboard_management = all(
                has_ems_permission(request.user, permission_code)
                for permission_code in (
                    "view_employee",
                    "add_employee",
                    "edit_employee",
                    "delete_employee",
                    "view_department",
                    "add_department",
                    "edit_department",
                    "delete_department",
                    "view_attendance",
                    "view_leave",
                    "approve_leave",
                    "reject_leave",
                    "view_task",
                    "add_task",
                    "edit_task",
                    "delete_task",
                    "assign_task",
                )
            )

            if has_full_dashboard_management:
                dashboard_scope = "company"
                sync_current_week_attendance(employee_qs)
                attendance_qs = Attendance.objects.filter(date=today)
            else:
                dashboard_scope = "personal"

                employee_qs = employee_qs.filter(user=request.user)
                leave_qs = leave_qs.filter(employee__user=request.user)

                employee = (
                    employee_qs
                    .select_related("department", "user")
                    .first()
                )

                if employee:
                    sync_current_week_attendance(employee_qs)

                    attendance_qs = Attendance.objects.filter(
                        date=today,
                        employee=employee,
                    )

                    employee_profile = EmployeeSerializer(employee).data

                    if employee.department_id:
                        department_qs = department_qs.filter(
                            pk=employee.department_id
                        )
                        task_qs = task_qs.filter(
                            department_id=employee.department_id
                        )
                    else:
                        department_qs = department_qs.none()
                        task_qs = task_qs.none()
                else:
                    department_qs = department_qs.none()
                    task_qs = task_qs.none()
                    attendance_qs = attendance_qs.none()

        employees_by_status = {
            row["status"]: row["count"]
            for row in employee_qs.values("status").annotate(count=Count("id"))
        }

        leaves_by_status = {
            row["status"]: row["count"]
            for row in leave_qs.values("status").annotate(count=Count("id"))
        }

        tasks_by_status = {
            row["status"]: row["count"]
            for row in task_qs.values("status").annotate(count=Count("id"))
        }

        attendance_by_status = {
            row["status"]: row["count"]
            for row in attendance_qs.values("status").annotate(count=Count("id"))
        }

        present_today = attendance_by_status.get(Attendance.Status.PRESENT, 0)
        late_today = attendance_by_status.get(Attendance.Status.LATE, 0)
        absent_today = attendance_by_status.get(Attendance.Status.ABSENT, 0)
        attendance_on_leave_today = attendance_by_status.get(
            Attendance.Status.ON_LEAVE,
            0,
        )
        day_off_today = attendance_by_status.get(Attendance.Status.DAY_OFF, 0)
        total_attendance_today = attendance_qs.count()

        data = {
            "dashboard_scope": dashboard_scope,
            "role": role,

            "total_employees": employee_qs.count(),
            "total_departments": department_qs.count(),
            "employees_by_status": employees_by_status,

            "attendance_today": {
                "present": present_today,
                "late": late_today,
                "absent": absent_today,
                "on_leave": attendance_on_leave_today,
                "day_off": day_off_today,
                "total": total_attendance_today,
            },
            "present_today": present_today,
            "late_today": late_today,
            "absent_today": absent_today,
            "attendance_on_leave_today": attendance_on_leave_today,
            "day_off_today": day_off_today,
            "total_attendance_today": total_attendance_today,

            "leaves_by_status": leaves_by_status,
            "pending_leave_requests": leaves_by_status.get(
                LeaveRequest.Status.PENDING,
                0,
            ),
            "on_leave_today": leave_qs.filter(
                status=LeaveRequest.Status.APPROVED,
                start_date__lte=today,
                end_date__gte=today,
            ).count(),
            "employees_by_department": list(
                department_qs
                .annotate(count=Count("employees"))
                .values("id", "name", "count")
                .order_by("-count")
            ),

            "leave_balance": (
                employee_profile.get("leave_balance", 0)
                if employee_profile
                else None
            ),
            "recent_leave_requests": LeaveRequestSerializer(
                leave_qs
                .select_related("employee", "employee__department")
                .order_by("-created_at")[:5],
                many=True,
            ).data,

            "tasks_by_status": tasks_by_status,
            "pending_tasks": tasks_by_status.get(Task.Status.PENDING, 0),
            "in_progress_tasks": tasks_by_status.get(
                Task.Status.IN_PROGRESS,
                0,
            ),
            "completed_tasks": tasks_by_status.get(Task.Status.COMPLETED, 0),
            "urgent_tasks": task_qs.filter(
                priority=Task.Priority.URGENT
            ).exclude(
                status=Task.Status.COMPLETED
            ).count(),
            "recent_tasks": TaskSerializer(
                task_qs
                .select_related(
                    "department",
                    "created_by",
                    "last_updated_by",
                )
                .order_by("-created_at")[:5],
                many=True,
            ).data,

            "employee_profile": employee_profile,
            "department_name": (
                employee_profile.get("department_name")
                if employee_profile
                else (
                    profile.department.name
                    if profile and profile.department
                    else None
                )
            ),
        }

        return Response(data)


# =========================================================
# ACTIVITY LOG
# =========================================================
class ActivityLogViewSet(
    viewsets.ReadOnlyModelViewSet
):
    serializer_class = (
        ActivityLogSerializer
    )

    permission_classes = [
        IsAuthenticated,
    ]

    def get_permissions(self):
        self.required_permission = "view_activity_log"
        return [IsAuthenticated(), HasEMSPermission()]

    queryset = (
        ActivityLog.objects
        .select_related(
            "actor"
        )
        .all()
    )

    search_fields = [
        "activity",
        "details",
        "actor__username",
    ]

    ordering_fields = [
        "created_at",
    ]


# =========================================================
# AUDIT LOG
# =========================================================
class AuditLogViewSet(
    viewsets.ReadOnlyModelViewSet
):
    serializer_class = (
        AuditLogSerializer
    )

    permission_classes = [
        IsAuthenticated,
    ]

    def get_permissions(self):
        self.required_permission = "view_audit_log"
        return [IsAuthenticated(), HasEMSPermission()]

    queryset = (
        AuditLog.objects
        .select_related(
            "actor"
        )
        .all()
    )

    filterset_fields = [
        "action",
        "model_name",
        "actor",
    ]

    search_fields = [
        "object_repr",
    ]

    ordering_fields = [
        "created_at",
    ]


# =========================================================
# ERROR LOG
# =========================================================
class ErrorLogViewSet(
    viewsets.ReadOnlyModelViewSet
):
    serializer_class = (
        ErrorLogSerializer
    )

    permission_classes = [
        IsAuthenticated,
    ]

    def get_permissions(self):
        self.required_permission = "view_error_log"
        return [IsAuthenticated(), HasEMSPermission()]

    queryset = (
        ErrorLog.objects
        .select_related(
            "user"
        )
        .all()
    )

    filterset_fields = [
        "level",
    ]

    search_fields = [
        "message",
        "path",
    ]

    ordering_fields = [
        "created_at",
    ]


# =========================================================
# CURRENT USER
# =========================================================
class MeView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    def get(
        self,
        request,
    ):
        role = role_of(
            request.user
        )

        profile = getattr(
            request.user,
            "ems_profile",
            None,
        )

        return Response({
            "id":
                request.user.id,

            "username":
                request.user.username,

            "first_name":
                request.user.first_name,

            "last_name":
                request.user.last_name,

            "role":
                role,

            "role_label":
                dict(
                    UserProfile.Role.choices
                ).get(
                    role,
                    role,
                ),

            "department":
                (
                    profile.department_id
                    if profile
                    else None
                ),

            "department_name":
                (
                    profile.department.name
                    if (
                        profile
                        and profile.department
                    )
                    else None
                ),

            "must_change_password":
                (
                    profile.must_change_password
                    if profile
                    else False
                ),

            "permissions":
                effective_permission_codes(request.user),

            "is_superuser":
                request.user.is_superuser,

            "is_staff":
                request.user.is_staff,
        })