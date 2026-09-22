from datetime import time

from django.conf import settings
from django.db import models
from django.utils import timezone


# =========================================================
# DEPARTMENT
# =========================================================
class Department(models.Model):
    name = models.CharField(
        max_length=120,
        unique=True,
    )

    description = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


# =========================================================
# USER PROFILE
# =========================================================
class UserProfile(models.Model):

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"

        GENERAL_MANAGER = (
            "general_manager",
            "General Manager",
        )

        DEPARTMENT_MANAGER = (
            "department_manager",
            "Department Manager",
        )

        EMPLOYEE = (
            "employee",
            "Employee",
        )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ems_profile",
    )

    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.EMPLOYEE,
    )

    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_profiles",
    )

    must_change_password = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def __str__(self):
        return (
            f"{self.user.username} "
            f"({self.get_role_display()})"
        )


# =========================================================
# CUSTOM PERMISSIONS
# =========================================================
class Permission(models.Model):
    code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=150)
    module = models.CharField(max_length=80)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["module", "name"]

    def __str__(self):
        return f"{self.module}: {self.name}"


class RolePermission(models.Model):
    role = models.CharField(
        max_length=30,
        choices=UserProfile.Role.choices,
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="role_permissions",
    )
    allowed = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["role", "permission"],
                name="unique_role_permission",
            )
        ]

    def __str__(self):
        return f"{self.role} - {self.permission.code}"


class UserPermissionOverride(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ems_permission_overrides",
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="user_overrides",
    )
    allowed = models.BooleanField(default=True)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="granted_ems_permissions",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "permission"],
                name="unique_user_permission_override",
            )
        ]

    def __str__(self):
        state = "Allowed" if self.allowed else "Denied"
        return f"{self.user.username} - {self.permission.code} - {state}"


# =========================================================
# EMPLOYEE
# =========================================================
class Employee(models.Model):

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"

        ON_LEAVE = (
            "on_leave",
            "On leave",
        )

        INACTIVE = (
            "inactive",
            "Inactive",
        )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employee_record",
    )

    first_name = models.CharField(
        max_length=80,
    )

    last_name = models.CharField(
        max_length=80,
    )

    email = models.EmailField(
        unique=True,
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
    )

    job_title = models.CharField(
        max_length=120,
        blank=True,
    )

    # =========================
    # EMERGENCY CONTACT
    # =========================
    emergency_contact_name = models.CharField(
        max_length=120,
        blank=True,
    )

    emergency_contact_relationship = models.CharField(
        max_length=80,
        blank=True,
    )

    emergency_contact_phone = models.CharField(
        max_length=30,
        blank=True,
    )

    photo = models.ImageField(
        upload_to="employee_photos/",
        blank=True,
        null=True,
    )

    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employees",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )

    date_hired = models.DateField(
        null=True,
        blank=True,
    )

    leave_balance = models.PositiveIntegerField(
        default=20,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "last_name",
            "first_name",
        ]

    def __str__(self):
        return (
            f"{self.first_name} "
            f"{self.last_name}"
        )

    @property
    def full_name(self):
        return (
            f"{self.first_name} "
            f"{self.last_name}"
        )


# =========================================================
# ATTENDANCE
# =========================================================
class Attendance(models.Model):

    class Status(models.TextChoices):
        PRESENT = (
            "present",
            "Present",
        )

        LATE = (
            "late",
            "Late",
        )

        ABSENT = (
            "absent",
            "Absent",
        )

        ON_LEAVE = (
            "on_leave",
            "On Leave",
        )

        DAY_OFF = (
            "day_off",
            "Day Off",
        )

    # =====================================================
    # WORK SETTINGS
    # =====================================================

    # Work starts
    WORK_START_TIME = time(8, 0)

    # 8:15 AM and later = Late
    LATE_FROM_TIME = time(8, 15)

    # Work ends
    WORK_END_TIME = time(16, 0)

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )

    date = models.DateField(
        db_index=True,
    )

    # Automatic marka user-ku login sameeyo
    check_in = models.DateTimeField(
        null=True,
        blank=True,
    )

    # Check Out button only
    check_out = models.DateTimeField(
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PRESENT,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "-date",
            "-check_in",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "employee",
                    "date",
                ],
                name=(
                    "unique_employee_"
                    "attendance_per_day"
                ),
            )
        ]

    def __str__(self):
        return (
            f"{self.employee.full_name} - "
            f"{self.date} - "
            f"{self.get_status_display()}"
        )

    # =====================================================
    # FRIDAY = DAY OFF
    #
    # Python weekday:
    # Monday    = 0
    # Tuesday   = 1
    # Wednesday = 2
    # Thursday  = 3
    # Friday    = 4
    # Saturday  = 5
    # Sunday    = 6
    # =====================================================
    @staticmethod
    def is_day_off(date_value):
        return date_value.weekday() == 4

    # =====================================================
    # WORKING DAY
    # =====================================================
    @classmethod
    def is_working_day(cls, date_value):
        return not cls.is_day_off(
            date_value
        )

    # =====================================================
    # CHECK-IN STATUS
    #
    # Before 8:15 AM = Present
    # 8:15 AM+       = Late
    # Friday         = Day Off
    # =====================================================
    @classmethod
    def get_check_in_status(
        cls,
        check_in_datetime,
    ):
        if not check_in_datetime:
            return cls.Status.ABSENT

        local_datetime = (
            timezone.localtime(
                check_in_datetime
            )
        )

        attendance_date = (
            local_datetime.date()
        )

        attendance_time = (
            local_datetime.time()
        )

        # Friday
        if cls.is_day_off(
            attendance_date
        ):
            return cls.Status.DAY_OFF

        # 8:15 AM and later
        if (
            attendance_time
            >= cls.LATE_FROM_TIME
        ):
            return cls.Status.LATE

        return cls.Status.PRESENT

    # =====================================================
    # TOTAL HOURS
    # =====================================================
    @property
    def total_hours(self):
        if (
            not self.check_in
            or not self.check_out
        ):
            return None

        duration = (
            self.check_out
            - self.check_in
        )

        return round(
            duration.total_seconds()
            / 3600,
            2,
        )

    # =====================================================
    # CHECKED IN?
    # =====================================================
    @property
    def is_checked_in(self):
        return bool(
            self.check_in
            and not self.check_out
        )

    # =====================================================
    # STATUS HELPERS
    # =====================================================
    @property
    def is_late(self):
        return (
            self.status
            == self.Status.LATE
        )

    @property
    def is_absent(self):
        return (
            self.status
            == self.Status.ABSENT
        )

    @property
    def is_on_leave(self):
        return (
            self.status
            == self.Status.ON_LEAVE
        )

    @property
    def is_day_off_record(self):
        return (
            self.status
            == self.Status.DAY_OFF
        )


# =========================================================
# LEAVE REQUEST
# =========================================================
class LeaveRequest(models.Model):

    class LeaveType(models.TextChoices):
        VACATION = (
            "vacation",
            "Vacation",
        )

        SICK = (
            "sick",
            "Sick",
        )

        PERSONAL = (
            "personal",
            "Personal",
        )

        UNPAID = (
            "unpaid",
            "Unpaid",
        )

        OTHER = (
            "other",
            "Other",
        )

    class Status(models.TextChoices):
        PENDING = (
            "pending",
            "Pending",
        )

        APPROVED = (
            "approved",
            "Approved",
        )

        REJECTED = (
            "rejected",
            "Rejected",
        )

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="leave_requests",
    )

    leave_type = models.CharField(
        max_length=20,
        choices=LeaveType.choices,
        default=LeaveType.VACATION,
    )

    start_date = models.DateField()

    end_date = models.DateField()

    reason = models.TextField(
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_leaves",
    )

    review_note = models.CharField(
        max_length=255,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "-created_at",
        ]

    def __str__(self):
        return (
            f"{self.employee} · "
            f"{self.start_date} "
            f"to {self.end_date} "
            f"({self.status})"
        )

    @property
    def days_requested(self):
        return (
            self.end_date
            - self.start_date
        ).days + 1


# =========================================================
# TASK
# =========================================================
class Task(models.Model):

    class Priority(models.TextChoices):
        LOW = (
            "low",
            "Low",
        )

        MEDIUM = (
            "medium",
            "Medium",
        )

        HIGH = (
            "high",
            "High",
        )

        URGENT = (
            "urgent",
            "Urgent",
        )

    class Status(models.TextChoices):
        PENDING = (
            "pending",
            "Pending",
        )

        IN_PROGRESS = (
            "in_progress",
            "In Progress",
        )

        COMPLETED = (
            "completed",
            "Completed",
        )

    title = models.CharField(
        max_length=180,
    )

    description = models.TextField(
        blank=True,
    )

    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name="tasks",
    )

    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    due_date = models.DateField(
        null=True,
        blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name=(
            "created_department_tasks"
        ),
    )

    last_updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name=(
            "updated_department_tasks"
        ),
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "-created_at",
        ]

    def __str__(self):
        return (
            f"{self.title} - "
            f"{self.department.name}"
        )


# =========================================================
# ACTIVITY LOG
# =========================================================
class ActivityLog(models.Model):

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_logs",
    )

    activity = models.CharField(
        max_length=120,
    )

    details = models.CharField(
        max_length=500,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = [
            "-created_at",
        ]

    def __str__(self):
        return (
            f"{self.activity} - "
            f"{self.actor or 'System'}"
        )


# =========================================================
# AUDIT LOG
# =========================================================
class AuditLog(models.Model):

    class Action(models.TextChoices):
        CREATE = (
            "create",
            "Create",
        )

        UPDATE = (
            "update",
            "Update",
        )

        DELETE = (
            "delete",
            "Delete",
        )

        APPROVE = (
            "approve",
            "Approve",
        )

        REJECT = (
            "reject",
            "Reject",
        )

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )

    action = models.CharField(
        max_length=20,
        choices=Action.choices,
    )

    model_name = models.CharField(
        max_length=60,
    )

    object_id = models.CharField(
        max_length=40,
        blank=True,
    )

    object_repr = models.CharField(
        max_length=255,
        blank=True,
    )

    changes = models.JSONField(
        default=dict,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = [
            "-created_at",
        ]

    def __str__(self):
        return (
            f"{self.get_action_display()} "
            f"{self.model_name} "
            f"#{self.object_id}"
        )


# =========================================================
# ERROR LOG
# =========================================================
class ErrorLog(models.Model):

    class Level(models.TextChoices):
        WARNING = (
            "warning",
            "Warning",
        )

        ERROR = (
            "error",
            "Error",
        )

        CRITICAL = (
            "critical",
            "Critical",
        )

    level = models.CharField(
        max_length=20,
        choices=Level.choices,
        default=Level.ERROR,
    )

    message = models.CharField(
        max_length=500,
    )

    path = models.CharField(
        max_length=255,
        blank=True,
    )

    method = models.CharField(
        max_length=10,
        blank=True,
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="triggered_errors",
    )

    traceback = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = [
            "-created_at",
        ]

    def __str__(self):
        return (
            f"[{self.level}] "
            f"{self.method} "
            f"{self.path}: "
            f"{self.message}"
        )