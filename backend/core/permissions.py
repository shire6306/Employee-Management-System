from rest_framework.permissions import BasePermission

from .models import (
    Permission,
    RolePermission,
    UserPermissionOverride,
    UserProfile,
)


def role_of(user):
    if not user or not user.is_authenticated:
        return None

    if user.is_superuser:
        return UserProfile.Role.ADMIN

    profile = getattr(user, "ems_profile", None)

    return (
        profile.role
        if profile
        else (
            UserProfile.Role.ADMIN
            if user.is_staff
            else UserProfile.Role.EMPLOYEE
        )
    )


def has_ems_permission(user, permission_code):
    """
    Permission resolution order:

    1. Superuser/Admin -> always allowed.
    2. User-specific override -> Grant/Revoke.
    3. Role default permission.
    4. Otherwise -> denied.
    """

    if not user or not user.is_authenticated:
        return False

    role = role_of(user)

    # Admin always has full system access.
    if (
        user.is_superuser
        or role == UserProfile.Role.ADMIN
    ):
        return True

    try:
        permission = Permission.objects.get(
            code=permission_code
        )
    except Permission.DoesNotExist:
        return False

    override = (
        UserPermissionOverride.objects
        .filter(
            user=user,
            permission=permission,
        )
        .first()
    )

    if override is not None:
        return override.allowed

    return (
        RolePermission.objects
        .filter(
            role=role,
            permission=permission,
            allowed=True,
        )
        .exists()
    )


class HasEMSPermission(BasePermission):
    """
    Usage in a DRF view:

        required_permission = "view_employee"
        permission_classes = [
            IsAuthenticated,
            HasEMSPermission,
        ]
    """

    message = (
        "You do not have permission "
        "to perform this action."
    )

    def has_permission(self, request, view):
        permission_code = getattr(
            view,
            "required_permission",
            None,
        )

        if not permission_code:
            return False

        return has_ems_permission(
            request.user,
            permission_code,
        )


class IsAdminOrGeneralManager(BasePermission):

    def has_permission(self, request, view):
        return role_of(request.user) in {
            UserProfile.Role.ADMIN,
            UserProfile.Role.GENERAL_MANAGER,
        }


class IsAdminOnly(BasePermission):

    def has_permission(self, request, view):
        return (
            role_of(request.user)
            == UserProfile.Role.ADMIN
        )


class IsAdminGeneralOrDepartmentManager(
    BasePermission
):

    def has_permission(self, request, view):
        return role_of(request.user) in {
            UserProfile.Role.ADMIN,
            UserProfile.Role.GENERAL_MANAGER,
            UserProfile.Role.DEPARTMENT_MANAGER,
        }