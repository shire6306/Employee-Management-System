# EMS Backend (Django + DRF + SQLite)

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

python manage.py migrate
python manage.py createsuperuser   # this account is what you log in with on the frontend
python manage.py seed_demo         # optional: adds demo departments/employees/leave requests

python manage.py runserver
```

The API runs at `http://127.0.0.1:8000/api/`. Admin site at `/admin/`.

## Auth

JWT login using your Django superuser (or any `is_staff`/normal user you create):

- `POST /api/auth/login/` `{ "username": "...", "password": "..." }` → `{ access, refresh }`
- `POST /api/auth/refresh/` `{ "refresh": "..." }` → `{ access }`

Send `Authorization: Bearer <access>` on every other request.

## Endpoints

| Endpoint | Notes |
|---|---|
| `/api/departments/` | CRUD. `?search=` |
| `/api/employees/` | CRUD. `?search=&department=<id>&status=active|on_leave|inactive` |
| `/api/leave-requests/` | CRUD. `?search=&status=&leave_type=&employee=<id>&department=<id>` |
| `/api/leave-requests/<id>/approve/` | `POST` — marks approved, deducts days from the employee's leave balance |
| `/api/leave-requests/<id>/reject/` | `POST` — marks rejected |
| `/api/stats/` | Dashboard aggregates |
| `/api/me/` | Current user |
| `/api/audit-logs/` | Read-only. Who did what — create/update/delete/approve/reject — across all records. `?action=&model_name=&actor=`. Staff/superuser only. |
| `/api/error-logs/` | Read-only. Unhandled exceptions captured while serving requests, with traceback. `?level=`. Staff/superuser only. |

All list endpoints support `?ordering=<field>` (prefix `-` for descending) and are paginated (`?page=`, `?page_size=`, max 200).

## Logging

- Every create/update/delete on Departments, Employees, and Leave requests — plus every approve/reject — is written to the `AuditLog` table (see `core/audit.py`), with the acting user, the action, and the changed fields.
- Any unhandled exception (API or admin) is written to the `ErrorLog` table with the request path, method, user, and full traceback (`core/exceptions.py`, `core/middleware.py`).
- Everything is also written to `backend/logs/app.log` (rotating, 5MB × 3 backups) and the console, via Django's `LOGGING` config in `settings.py`.
- Both logs are browsable at `/admin/` (read-only) or through the API endpoints above; the frontend's **Activity** page shows both.
