import random
from datetime import date, timedelta

from django.core.management.base import BaseCommand

from core.models import Department, Employee, LeaveRequest


DEPARTMENTS = ["Engineering", "Sales", "Marketing", "Human Resources", "Finance", "Support"]

FIRST_NAMES = ["Amina", "Yusuf", "Layla", "Omar", "Fatima", "Ibrahim", "Hodan", "Ahmed", "Sara", "Mohamed"]
LAST_NAMES = ["Ali", "Hassan", "Warsame", "Nur", "Farah", "Ismail", "Abdullahi", "Jama", "Mire", "Yusuf"]

JOB_TITLES = ["Engineer", "Manager", "Analyst", "Coordinator", "Specialist", "Director"]


class Command(BaseCommand):
    help = "Seed the database with demo departments, employees, and leave requests."

    def handle(self, *args, **options):
        random.seed(42)

        departments = []
        for name in DEPARTMENTS:
            dept, _ = Department.objects.get_or_create(name=name, defaults={"description": f"{name} department"})
            departments.append(dept)

        employees = []
        for i in range(30):
            first = random.choice(FIRST_NAMES)
            last = random.choice(LAST_NAMES)
            email = f"{first.lower()}.{last.lower()}{i}@example.com"
            if Employee.objects.filter(email=email).exists():
                continue
            emp = Employee.objects.create(
                first_name=first,
                last_name=last,
                email=email,
                phone=f"+252 61 {random.randint(1000000, 9999999)}",
                job_title=random.choice(JOB_TITLES),
                department=random.choice(departments),
                status=random.choices(
                    [Employee.Status.ACTIVE, Employee.Status.ON_LEAVE, Employee.Status.INACTIVE],
                    weights=[0.75, 0.15, 0.10],
                )[0],
                date_hired=date.today() - timedelta(days=random.randint(30, 2000)),
                leave_balance=random.randint(5, 25),
            )
            employees.append(emp)

        leave_types = [c[0] for c in LeaveRequest.LeaveType.choices]
        for emp in employees:
            for _ in range(random.randint(0, 3)):
                start = date.today() + timedelta(days=random.randint(-30, 30))
                end = start + timedelta(days=random.randint(0, 5))
                LeaveRequest.objects.create(
                    employee=emp,
                    leave_type=random.choice(leave_types),
                    start_date=start,
                    end_date=end,
                    reason="Demo seeded leave request.",
                    status=random.choices(
                        [LeaveRequest.Status.PENDING, LeaveRequest.Status.APPROVED, LeaveRequest.Status.REJECTED],
                        weights=[0.4, 0.4, 0.2],
                    )[0],
                )

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {len(departments)} departments, {len(employees)} employees, "
            f"{LeaveRequest.objects.count()} leave requests."
        ))
