EMS UPDATED FEATURES
====================
Added:
- Roles: Admin, General Manager, Department Manager, Employee
- User Management inside the system
- Create login accounts and reset passwords
- Department Tasks with Low/Medium/High/Urgent priority
- Task progress: Pending / In Progress / Completed
- Activity Log + Audit Log for Admin and General Manager
- Error Log for Admin only
- Role-based sidebar/routes/API permissions

COPY LOCATIONS
==============
backend/core/*                 -> your backend/core/
backend/ems_project/*          -> your backend/ems_project/
frontend/src/*                 -> your frontend/src/

IMPORTANT
=========
Keep your existing manage.py, package.json, requirements.txt, db.sqlite3 and existing migration 0001_initial.py.
The included migration is 0002_roles_tasks_activity.py.

RUN BACKEND (PowerShell)
========================
cd C:\Users\HP\OneDrive\Desktop\ems\backend
.\.venv\Scripts\Activate.ps1
python manage.py migrate
python manage.py runserver

If migration 0002 reports a dependency/name problem, delete only the new 0002_roles_tasks_activity.py and run:
python manage.py makemigrations core
python manage.py migrate

RUN FRONTEND (new PowerShell terminal)
======================================
cd C:\Users\HP\OneDrive\Desktop\ems\frontend
npm install
npm run dev

LOGIN
=====
Use your existing Django superuser as Admin.
Admin can open User Management and create General Manager, Department Manager, or Employee accounts.
General Manager can create Department Manager/Employee accounts and reset their passwords.
