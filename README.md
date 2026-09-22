# EMS Frontend (React + Vite)

## Setup

```bash
cd frontend
npm install
cp .env.example .env      # points at http://127.0.0.1:8000/api by default
npm run dev
```

Open `http://localhost:5173` and sign in with the Django superuser you created for the backend.

## Structure

- `src/api/client.js` — axios instance; attaches the JWT, and silently refreshes it on 401s.
- `src/context/AuthContext.jsx` — login/logout state, exposed via `useAuth()`.
- `src/pages/` — `Login`, `Dashboard`, `Employees`, `Departments`, `LeaveRequests`.
- `src/components/Layout.jsx` — sidebar navigation shell for authenticated pages.
