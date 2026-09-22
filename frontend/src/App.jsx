import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import DepartmentDetails from "./pages/DepartmentDetails.jsx";

import Layout from "./components/Layout.jsx";

import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Employees from "./pages/Employees.jsx";
import EmployeeProfile from "./pages/EmployeeProfile.jsx";
import Departments from "./pages/Departments.jsx";
import LeaveRequests from "./pages/LeaveRequests.jsx";
import Activity from "./pages/Activity.jsx";
import Tasks from "./pages/Tasks.jsx";
import UserManagement from "./pages/UserManagement.jsx";
import Attendance from "./pages/Attendance.jsx";
import Permissions from "./pages/Permissions.jsx";


// =====================================================
// PROTECTED ROUTE
// User must be logged in
// =====================================================
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          height: "100vh",
        }}
      >
        Loading...
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}


// =====================================================
// ROLE ROUTE
// Used only where the actual role must be restricted.
// Example: Permission Management = Admin only.
// =====================================================
function RoleRoute({ roles, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: "300px",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isSuperuser = user?.is_superuser === true;

  if (isSuperuser || roles.includes(user.role)) {
    return children;
  }

  return <Navigate to="/" replace />;
}


// =====================================================
// PERMISSION ROUTE
//
// permission="view_employee"
//
// OR
//
// any={[
//   "view_activity_log",
//   "view_audit_log",
// ]}
//
// Admin / Superuser always allowed.
// =====================================================
function PermissionRoute({
  permission,
  any = [],
  children,
}) {
  const {
    user,
    loading,
    hasPermission,
    hasAnyPermission,
  } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: "300px",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin / Superuser always has access
  if (
    user.role === "admin" ||
    user.is_superuser === true
  ) {
    return children;
  }

  // One permission required
  if (
    permission &&
    hasPermission(permission)
  ) {
    return children;
  }

  // At least one permission required
  if (
    any.length > 0 &&
    hasAnyPermission(any)
  ) {
    return children;
  }

  return <Navigate to="/" replace />;
}


// =====================================================
// EMPLOYEE OR PERMISSION ROUTE
//
// Used for pages where an Employee must always be
// allowed to access their OWN information.
//
// Employee:
// - Can enter even if the permission is OFF.
// - Backend decides the Employee's own-data scope.
//
// Other roles:
// - Need the requested permission.
//
// Admin / Superuser:
// - Always allowed.
// =====================================================
function EmployeeOrPermissionRoute({
  permission,
  children,
}) {
  const {
    user,
    loading,
    hasPermission,
  } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: "300px",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin / Superuser always allowed
  if (
    user.role === "admin" ||
    user.is_superuser === true
  ) {
    return children;
  }

  // Employee can always open the page
  // so they can see their own information.
  if (user.role === "employee") {
    return children;
  }

  // Other roles need the permission.
  if (
    permission &&
    hasPermission(permission)
  ) {
    return children;
  }

  return <Navigate to="/" replace />;
}


// =====================================================
// APP
// =====================================================
export default function App() {
  return (
    <Routes>

      {/* =================================================
          LOGIN
      ================================================= */}
      <Route
        path="/login"
        element={<Login />}
      />


      {/* =================================================
          PROTECTED EMS
      ================================================= */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >

        {/* ===============================================
            DASHBOARD
        =============================================== */}
        <Route
          index
          element={
            <PermissionRoute permission="view_dashboard">
              <Dashboard />
            </PermissionRoute>
          }
        />


        {/* ===============================================
            EMPLOYEES LIST
        =============================================== */}
        <Route
          path="employees"
          element={
            <PermissionRoute permission="view_employee">
              <Employees />
            </PermissionRoute>
          }
        />


        {/* ===============================================
            EMPLOYEE PROFILE
        =============================================== */}
        <Route
          path="employees/:id"
          element={
            <PermissionRoute permission="view_employee">
              <EmployeeProfile />
            </PermissionRoute>
          }
        />


        {/* ===============================================
            DEPARTMENTS
        =============================================== */}
        <Route
          path="departments"
          element={
            <PermissionRoute permission="view_department">
              <Departments />
            </PermissionRoute>
          }
        />


        {/* ===============================================
            DEPARTMENT DETAILS
        =============================================== */}
        <Route
          path="departments/:id"
          element={
            <PermissionRoute permission="view_department">
              <DepartmentDetails />
            </PermissionRoute>
          }
        />


        {/* ===============================================
            LEAVE REQUESTS
        =============================================== */}
        <Route
          path="leave-requests"
          element={
            <PermissionRoute permission="view_leave">
              <LeaveRequests />
            </PermissionRoute>
          }
        />


        {/* ===============================================
            TASKS
        =============================================== */}
        <Route
          path="tasks"
          element={
            <PermissionRoute permission="view_task">
              <Tasks />
            </PermissionRoute>
          }
        />


        {/* ===============================================
            ATTENDANCE

            Employee:
            - Always allowed to open Attendance.
            - If view_attendance is OFF, backend will
              return only their own attendance.
            - If wider attendance permission/scope is
              available, backend controls that scope.

            Other roles:
            - Must have view_attendance.

            Admin / Superuser:
            - Always allowed.
        =============================================== */}
        <Route
          path="attendance"
          element={
            <EmployeeOrPermissionRoute permission="view_attendance">
              <Attendance />
            </EmployeeOrPermissionRoute>
          }
        />


        {/* ===============================================
            USER MANAGEMENT

            Anyone with view_user permission can open it.

            Add/Edit/Delete actions are controlled
            separately by their permissions.
        =============================================== */}
        <Route
          path="users"
          element={
            <PermissionRoute permission="view_user">
              <UserManagement />
            </PermissionRoute>
          }
        />


        {/* ===============================================
            PERMISSION MANAGEMENT

            IMPORTANT:
            Admin / Superuser only.

            Even if Employee gets all permissions,
            they cannot grant/revoke permissions.
        =============================================== */}
        <Route
          path="permissions"
          element={
            <RoleRoute roles={["admin"]}>
              <Permissions />
            </RoleRoute>
          }
        />


        {/* ===============================================
            LOGS

            User only needs ONE of these permissions
            to enter the Logs page.

            Activity.jsx decides which tabs
            are visible.
        =============================================== */}
        <Route
          path="activity"
          element={
            <PermissionRoute
              any={[
                "view_activity_log",
                "view_audit_log",
                "view_error_log",
              ]}
            >
              <Activity />
            </PermissionRoute>
          }
        />

      </Route>


      {/* =================================================
          UNKNOWN URL
      ================================================= */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />

    </Routes>
  );
}