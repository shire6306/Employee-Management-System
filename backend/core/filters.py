import django_filters as df

from .models import Employee, LeaveRequest


class EmployeeFilter(df.FilterSet):
    department = df.NumberFilter(field_name="department_id")
    status = df.CharFilter(field_name="status")
    date_hired_after = df.DateFilter(field_name="date_hired", lookup_expr="gte")
    date_hired_before = df.DateFilter(field_name="date_hired", lookup_expr="lte")

    class Meta:
        model = Employee
        fields = ["department", "status"]


class LeaveRequestFilter(df.FilterSet):
    employee = df.NumberFilter(field_name="employee_id")
    department = df.NumberFilter(field_name="employee__department_id")
    status = df.CharFilter(field_name="status")
    leave_type = df.CharFilter(field_name="leave_type")
    start_date_after = df.DateFilter(field_name="start_date", lookup_expr="gte")
    start_date_before = df.DateFilter(field_name="start_date", lookup_expr="lte")

    class Meta:
        model = LeaveRequest
        fields = ["employee", "department", "status", "leave_type"]
