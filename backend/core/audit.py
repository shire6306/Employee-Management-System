from .models import AuditLog


def _safe_changes(data):
    """Flatten a serializer's validated_data into JSON-safe primitives."""
    safe = {}
    for key, value in (data or {}).items():
        if hasattr(value, "pk"):
            safe[key] = str(value.pk)
        else:
            safe[key] = str(value) if value is not None else None
    return safe


def log_action(request, action, instance, changes=None):
    user = getattr(request, "user", None)
    AuditLog.objects.create(
        actor=user if user is not None and user.is_authenticated else None,
        action=action,
        model_name=instance.__class__.__name__,
        object_id=str(instance.pk),
        object_repr=str(instance)[:255],
        changes=_safe_changes(changes) if changes else {},
    )


class AuditLoggingMixin:
    """Drop into a ModelViewSet to automatically log create/update/delete."""

    def perform_create(self, serializer):
        instance = serializer.save()
        log_action(self.request, AuditLog.Action.CREATE, instance, serializer.validated_data)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_action(self.request, AuditLog.Action.UPDATE, instance, serializer.validated_data)

    def perform_destroy(self, instance):
        log_action(self.request, AuditLog.Action.DELETE, instance)
        instance.delete()
