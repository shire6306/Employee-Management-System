from django.contrib.auth.models import User
from django.contrib.auth.password_validation import (
    validate_password,
)
from django.db import transaction

from rest_framework import serializers

from .models import (
    ActivityLog,
    AuditLog,
    Department,
    Employee,
    Attendance,
    ErrorLog,
    LeaveRequest,
    Task,
    UserProfile,
    Permission,
    RolePermission,
    UserPermissionOverride,
)


# =========================================================
# USER MINI
# =========================================================
class UserMiniSerializer(
    serializers.ModelSerializer
):

    class Meta:
        model = User

        fields = [
            "id",
            "username",
        ]


# =========================================================
# CUSTOM PERMISSIONS
# =========================================================
class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = [
            "id",
            "code",
            "name",
            "module",
            "description",
        ]
        read_only_fields = fields


class RolePermissionSerializer(serializers.ModelSerializer):
    permission = PermissionSerializer(read_only=True)

    class Meta:
        model = RolePermission
        fields = [
            "id",
            "role",
            "permission",
            "allowed",
        ]
        read_only_fields = fields


class UserPermissionOverrideSerializer(serializers.ModelSerializer):
    permission = PermissionSerializer(read_only=True)
    permission_id = serializers.PrimaryKeyRelatedField(
        source="permission",
        queryset=Permission.objects.all(),
        write_only=True,
    )
    granted_by = UserMiniSerializer(read_only=True)

    class Meta:
        model = UserPermissionOverride
        fields = [
            "id",
            "permission",
            "permission_id",
            "allowed",
            "granted_by",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "permission",
            "granted_by",
            "updated_at",
        ]


class UserPermissionsUpdateSerializer(serializers.Serializer):
    permissions = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=True,
    )

    def validate_permissions(self, value):
        cleaned = []
        seen = set()

        for item in value:
            code = item.get("code")
            allowed = item.get("allowed")

            if not code:
                raise serializers.ValidationError(
                    "Each permission requires a code."
                )

            if not isinstance(allowed, bool):
                raise serializers.ValidationError(
                    f"Permission '{code}' requires allowed=true or false."
                )

            if code in seen:
                raise serializers.ValidationError(
                    f"Permission '{code}' was provided more than once."
                )

            permission = Permission.objects.filter(code=code).first()
            if not permission:
                raise serializers.ValidationError(
                    f"Unknown permission code: {code}"
                )

            seen.add(code)
            cleaned.append({
                "permission": permission,
                "allowed": allowed,
            })

        return cleaned


def effective_permission_codes(user):
    if not user or not user.is_authenticated:
        return []

    if user.is_superuser:
        return list(
            Permission.objects.order_by("code")
            .values_list("code", flat=True)
        )

    profile = getattr(user, "ems_profile", None)
    if not profile:
        return []

    if profile.role == UserProfile.Role.ADMIN:
        return list(
            Permission.objects.order_by("code")
            .values_list("code", flat=True)
        )

    effective = set(
        RolePermission.objects.filter(
            role=profile.role,
            allowed=True,
        ).values_list("permission__code", flat=True)
    )

    overrides = (
        UserPermissionOverride.objects
        .filter(user=user)
        .select_related("permission")
    )

    for override in overrides:
        if override.allowed:
            effective.add(override.permission.code)
        else:
            effective.discard(override.permission.code)

    return sorted(effective)


# =========================================================
# DEPARTMENT
# =========================================================
class DepartmentSerializer(
    serializers.ModelSerializer
):
    employee_count = (
        serializers.IntegerField(
            read_only=True,
        )
    )

    class Meta:
        model = Department

        fields = [
            "id",
            "name",
            "description",
            "employee_count",
            "created_at",
        ]


# =========================================================
# EMPLOYEE
# =========================================================
class EmployeeSerializer(
    serializers.ModelSerializer
):
    department_name = (
        serializers.CharField(
            source="department.name",
            read_only=True,
            default=None,
        )
    )

    full_name = (
        serializers.CharField(
            read_only=True,
        )
    )

    username = (
        serializers.CharField(
            source="user.username",
            read_only=True,
            default=None,
        )
    )

    photo = (
        serializers.ImageField(
            required=False,
            allow_null=True,
            use_url=True,
        )
    )

    class Meta:
        model = Employee

        fields = [
            "id",
            "user",
            "username",

            "first_name",
            "last_name",
            "full_name",

            "email",
            "phone",
            "job_title",

            "emergency_contact_name",
            "emergency_contact_relationship",
            "emergency_contact_phone",

            "department",
            "department_name",

            "status",
            "date_hired",
            "leave_balance",

            "photo",

            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "user",
        ]


# =========================================================
# ATTENDANCE
# =========================================================
class AttendanceSerializer(
    serializers.ModelSerializer
):
    employee_name = (
        serializers.CharField(
            source="employee.full_name",
            read_only=True,
        )
    )

    department_name = (
        serializers.CharField(
            source="employee.department.name",
            read_only=True,
            default=None,
        )
    )

    total_hours = (
        serializers.ReadOnlyField()
    )

    status_label = (
        serializers.CharField(
            source="get_status_display",
            read_only=True,
        )
    )

    is_late = (
        serializers.BooleanField(
            read_only=True,
        )
    )

    is_absent = (
        serializers.BooleanField(
            read_only=True,
        )
    )

    is_on_leave = (
        serializers.BooleanField(
            read_only=True,
        )
    )

    is_day_off = (
        serializers.BooleanField(
            source="is_day_off_record",
            read_only=True,
        )
    )

    class Meta:
        model = Attendance

        fields = [
            "id",

            "employee",
            "employee_name",
            "department_name",

            "date",

            "check_in",
            "check_out",

            "status",
            "status_label",

            "is_late",
            "is_absent",
            "is_on_leave",
            "is_day_off",

            "total_hours",

            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "employee",
            "date",
            "check_in",
            "check_out",

            "status",
            "status_label",

            "is_late",
            "is_absent",
            "is_on_leave",
            "is_day_off",

            "created_at",
            "updated_at",
        ]


# =========================================================
# LEAVE REQUEST
# =========================================================
class LeaveRequestSerializer(
    serializers.ModelSerializer
):
    employee_name = (
        serializers.CharField(
            source="employee.full_name",
            read_only=True,
        )
    )

    department_name = (
        serializers.CharField(
            source="employee.department.name",
            read_only=True,
            default=None,
        )
    )

    days_requested = (
        serializers.IntegerField(
            read_only=True,
        )
    )

    reviewed_by = (
        UserMiniSerializer(
            read_only=True,
        )
    )

    class Meta:
        model = LeaveRequest

        fields = [
            "id",

            "employee",
            "employee_name",
            "department_name",

            "leave_type",

            "start_date",
            "end_date",
            "days_requested",

            "reason",
            "status",

            "reviewed_by",
            "review_note",

            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "status",
            "reviewed_by",
        ]

    def validate(
        self,
        attrs,
    ):
        start = attrs.get(
            "start_date",
            getattr(
                self.instance,
                "start_date",
                None,
            ),
        )

        end = attrs.get(
            "end_date",
            getattr(
                self.instance,
                "end_date",
                None,
            ),
        )

        if (
            start
            and end
            and end < start
        ):
            raise serializers.ValidationError(
                "End date cannot be "
                "before start date."
            )

        return attrs


# =========================================================
# LEAVE REVIEW
# =========================================================
class LeaveReviewSerializer(
    serializers.Serializer
):
    review_note = (
        serializers.CharField(
            required=False,
            allow_blank=True,
            max_length=255,
        )
    )


# =========================================================
# USER MANAGEMENT
# =========================================================
class UserManagementSerializer(
    serializers.ModelSerializer
):
    effective_permissions = serializers.SerializerMethodField()

    role = (
        serializers.CharField(
            source="ems_profile.role",
            read_only=True,
        )
    )

    department = (
        serializers.IntegerField(
            source=(
                "ems_profile.department_id"
            ),
            read_only=True,
        )
    )

    department_name = (
        serializers.CharField(
            source=(
                "ems_profile.department.name"
            ),
            read_only=True,
            default=None,
        )
    )

    employee_id = (
        serializers.IntegerField(
            source="employee_record.id",
            read_only=True,
            default=None,
        )
    )

    def get_effective_permissions(self, obj):
        return effective_permission_codes(obj)

    class Meta:
        model = User

        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",

            "is_active",

            "role",

            "department",
            "department_name",

            "employee_id",
            "effective_permissions",
        ]


# =========================================================
# USER CREATE
# =========================================================
class UserCreateSerializer(
    serializers.Serializer
):
    username = (
        serializers.CharField(
            max_length=150,
        )
    )

    password = (
        serializers.CharField(
            write_only=True,
            min_length=8,
        )
    )

    first_name = (
        serializers.CharField(
            max_length=80,
        )
    )

    last_name = (
        serializers.CharField(
            max_length=80,
        )
    )

    email = (
        serializers.EmailField()
    )

    role = (
        serializers.ChoiceField(
            choices=[
                UserProfile.Role.EMPLOYEE,

                UserProfile.Role.DEPARTMENT_MANAGER,

                UserProfile.Role.GENERAL_MANAGER,
            ],
        )
    )

    department = (
        serializers.PrimaryKeyRelatedField(
            queryset=(
                Department.objects.all()
            ),
            required=False,
            allow_null=True,
        )
    )

    phone = (
        serializers.CharField(
            required=False,
            allow_blank=True,
            max_length=30,
        )
    )

    job_title = (
        serializers.CharField(
            required=False,
            allow_blank=True,
            max_length=120,
        )
    )

    def validate_username(
        self,
        value,
    ):
        if (
            User.objects.filter(
                username__iexact=value
            ).exists()
        ):
            raise serializers.ValidationError(
                "Username already exists."
            )

        return value

    def validate_email(
        self,
        value,
    ):
        employee = (
            Employee.objects
            .filter(
                email__iexact=value
            )
            .first()
        )

        if (
            employee
            and employee.user_id
        ):
            raise serializers.ValidationError(
                "This employee already has "
                "a system user account."
            )

        if (
            User.objects.filter(
                email__iexact=value
            ).exists()
        ):
            raise serializers.ValidationError(
                "A system user with this "
                "email already exists."
            )

        return value

    def validate_password(
        self,
        value,
    ):
        validate_password(value)

        return value

    def validate(
        self,
        attrs,
    ):
        role = attrs.get(
            "role"
        )

        department = attrs.get(
            "department"
        )

        if (
            role
            in {
                UserProfile.Role.EMPLOYEE,
                UserProfile.Role.DEPARTMENT_MANAGER,
            }
            and not department
        ):
            raise serializers.ValidationError({
                "department":
                    "Department is required "
                    "for Employee and "
                    "Department Manager accounts."
            })

        if (
            role
            == UserProfile.Role.GENERAL_MANAGER
        ):
            attrs["department"] = None

        return attrs

    @transaction.atomic
    def create(
        self,
        validated_data,
    ):
        department = (
            validated_data.pop(
                "department",
                None,
            )
        )

        role = validated_data.pop(
            "role"
        )

        phone = validated_data.pop(
            "phone",
            "",
        )

        job_title = (
            validated_data.pop(
                "job_title",
                "",
            )
        )

        password = (
            validated_data.pop(
                "password"
            )
        )

        employee = (
            Employee.objects
            .select_for_update()
            .filter(
                email__iexact=
                    validated_data[
                        "email"
                    ]
            )
            .first()
        )

        if (
            employee
            and employee.user_id
        ):
            raise serializers.ValidationError({
                "email":
                    "This employee already "
                    "has a system user account."
            })

        user = User.objects.create_user(
            password=password,
            **validated_data,
        )

        UserProfile.objects.create(
            user=user,
            role=role,
            department=department,
            must_change_password=True,
        )

        if employee:
            employee.user = user

            employee.first_name = (
                user.first_name
            )

            employee.last_name = (
                user.last_name
            )

            employee.department = (
                department
            )

            if phone:
                employee.phone = phone

            if job_title:
                employee.job_title = (
                    job_title
                )

            elif (
                role
                == UserProfile.Role.DEPARTMENT_MANAGER
                and not employee.job_title
            ):
                employee.job_title = (
                    "Department Manager"
                )

            employee.save()

        else:
            Employee.objects.create(
                user=user,

                first_name=
                    user.first_name,

                last_name=
                    user.last_name,

                email=user.email,

                phone=phone,

                job_title=(
                    job_title
                    or (
                        "Department Manager"
                        if (
                            role
                            == UserProfile.Role.DEPARTMENT_MANAGER
                        )
                        else ""
                    )
                ),

                department=department,
            )

        return user


# =========================================================
# PASSWORD RESET
# =========================================================
class PasswordResetSerializer(
    serializers.Serializer
):
    new_password = (
        serializers.CharField(
            write_only=True,
            min_length=8,
        )
    )

    def validate_new_password(
        self,
        value,
    ):
        validate_password(value)

        return value


# =========================================================
# TASK
# =========================================================
class TaskSerializer(
    serializers.ModelSerializer
):
    department_name = (
        serializers.CharField(
            source="department.name",
            read_only=True,
        )
    )

    created_by = (
        UserMiniSerializer(
            read_only=True,
        )
    )

    last_updated_by = (
        UserMiniSerializer(
            read_only=True,
        )
    )

    class Meta:
        model = Task

        fields = [
            "id",

            "title",
            "description",

            "department",
            "department_name",

            "priority",
            "status",
            "due_date",

            "created_by",
            "last_updated_by",

            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "created_by",
            "last_updated_by",
        ]


# =========================================================
# TASK STATUS
# =========================================================
class TaskStatusSerializer(
    serializers.Serializer
):
    status = (
        serializers.ChoiceField(
            choices=(
                Task.Status.choices
            ),
        )
    )


# =========================================================
# ACTIVITY LOG
# =========================================================
class ActivityLogSerializer(
    serializers.ModelSerializer
):
    actor = (
        UserMiniSerializer(
            read_only=True,
        )
    )

    class Meta:
        model = ActivityLog

        fields = [
            "id",
            "actor",
            "activity",
            "details",
            "created_at",
        ]


# =========================================================
# AUDIT LOG
# =========================================================
class AuditLogSerializer(
    serializers.ModelSerializer
):
    actor = (
        UserMiniSerializer(
            read_only=True,
        )
    )

    class Meta:
        model = AuditLog

        fields = [
            "id",
            "actor",
            "action",
            "model_name",
            "object_id",
            "object_repr",
            "changes",
            "created_at",
        ]


# =========================================================
# ERROR LOG
# =========================================================
class ErrorLogSerializer(
    serializers.ModelSerializer
):
    user = (
        UserMiniSerializer(
            read_only=True,
        )
    )

    class Meta:
        model = ErrorLog

        fields = [
            "id",
            "level",
            "message",
            "path",
            "method",
            "user",
            "traceback",
            "created_at",
        ]