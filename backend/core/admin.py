from django.contrib import admin
from .models import ActivityLog, AuditLog, Department, Employee, ErrorLog, LeaveRequest, Task, UserProfile

admin.site.register(Department)
admin.site.register(Employee)
admin.site.register(LeaveRequest)
admin.site.register(UserProfile)
admin.site.register(Task)

@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "actor", "activity", "details"]
    readonly_fields = [f.name for f in ActivityLog._meta.fields]
    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "actor", "action", "model_name", "object_repr"]
    list_filter = ["action", "model_name"]
    readonly_fields = [f.name for f in AuditLog._meta.fields]
    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False

@admin.register(ErrorLog)
class ErrorLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "level", "method", "path", "message"]
    list_filter = ["level"]
    readonly_fields = [f.name for f in ErrorLog._meta.fields]
    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False
