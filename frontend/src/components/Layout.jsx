import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  NavLink,
  Outlet,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { client } from "../api/client.js";


// ========================================
// SIDEBAR ICONS
// ========================================
const icons = {
  Dashboard: "▥",
  Employees: "♙",
  Profile: "♙",

  Departments: "▤",
  Department: "▤",

  "Leave Requests": "▣",

  Tasks: "✓",

  Attendance: "◷",

  "User Management": "⚙",
  Permissions: "🔐",
  Logs: "▧",
};


// ========================================
// SESSION SETTINGS
// ========================================

// Warning after 4 minutes inactivity
const WARNING_TIME =  4 * 60 * 1000;

// Warning countdown = 60 seconds
const WARNING_SECONDS = 20;


// ========================================
// MAIN LAYOUT
// ========================================
export default function Layout() {
  const { user, logout, hasPermission, hasAnyPermission } = useAuth();

  const role = user?.role;

  // ========================================
  // EMPLOYEE NAVIGATION MODE
  // Employee with management permissions sees
  // Employees instead of Profile.
  // ========================================
  const hasEmployeeManagementPermission =
    hasAnyPermission([
      "add_employee",
      "edit_employee",
      "delete_employee",
    ]);

  const showEmployeesMode =
    role !== "employee" ||
    hasEmployeeManagementPermission;


  // ========================================
  // DEPARTMENT NAVIGATION MODE
  // ========================================
  const hasDepartmentManagementPermission =
    hasAnyPermission([
      "add_department",
      "edit_department",
      "delete_department",
    ]);

  const showDepartmentsMode =
    role !== "employee" ||
    hasDepartmentManagementPermission;


  // ========================================
  // ATTENDANCE STATES
  // ========================================
  const [attendance, setAttendance] =
    useState(null);

  const [
    attendanceLoading,
    setAttendanceLoading,
  ] = useState(true);

  const [
    checkOutLoading,
    setCheckOutLoading,
  ] = useState(false);

  const [
    attendanceError,
    setAttendanceError,
  ] = useState("");


  // ========================================
  // SESSION STATES
  // ========================================
  const [
    showSessionWarning,
    setShowSessionWarning,
  ] = useState(false);

  const [
    sessionSeconds,
    setSessionSeconds,
  ] = useState(WARNING_SECONDS);

  const [
    sessionExpired,
    setSessionExpired,
  ] = useState(false);


  // ========================================
  // TIMER REFERENCES
  // ========================================
  const warningTimerRef =
    useRef(null);

  const countdownTimerRef =
    useRef(null);

  const warningVisibleRef =
    useRef(false);

  const sessionExpiredRef =
    useRef(false);

  const logoutRef =
    useRef(logout);


  // ========================================
  // KEEP LATEST LOGOUT FUNCTION
  // ========================================
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);


  // ========================================
  // SIDEBAR NAVIGATION
  // ========================================
  const nav = [
    {
      to: "/",
      label: "Dashboard",
      end: true,
      permission: "view_dashboard",
    },
    {
      to: "/employees",
      label: showEmployeesMode
        ? "Employees"
        : "Profile",
      permission: "view_employee",
    },
    {
      to: "/departments",
      label: showDepartmentsMode
        ? "Departments"
        : "Department",
      permission: "view_department",
    },
    {
      to: "/leave-requests",
      label: "Leave Requests",
      permission: "view_leave",
    },
    {
      to: "/tasks",
      label: "Tasks",
      permission: "view_task",
    },
    {
      to: "/attendance",
      label: "Attendance",
      permission: "view_attendance",
      employeeAlways: true,
    },
    {
      to: "/users",
      label: "User Management",
      permission: "view_user",
    },
    {
      to: "/permissions",
      label: "Permissions",
      adminOnly: true,
    },
    {
      to: "/activity",
      label: "Logs",
      anyPermissions: [
        "view_activity_log",
        "view_audit_log",
        "view_error_log",
      ],
    },
  ].filter((item) => {
    if (item.adminOnly) {
      return role === "admin" || user?.is_superuser === true;
    }
    if (
      item.employeeAlways &&
      role === "employee"
    ) {
      return true;
    }
    if (item.permission) return hasPermission(item.permission);
    if (item.anyPermissions) return hasAnyPermission(item.anyPermissions);
    return false;
  });


  // ========================================
  // LOAD ATTENDANCE
  // ========================================
  useEffect(() => {
    if (
      role === "employee" ||
      hasPermission("view_attendance")
    ) {
      loadTodayAttendance();
    } else {
      setAttendance(null);
      setAttendanceLoading(false);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.permissions]);


  async function loadTodayAttendance() {
    try {
      setAttendanceLoading(true);
      setAttendanceError("");

      const response =
        await client.get(
          "/attendance/today/"
        );

      setAttendance(
        response.data?.attendance ||
          null
      );
    } catch (error) {
      console.error(
        "Attendance load error:",
        error
      );

      setAttendance(null);
    } finally {
      setAttendanceLoading(false);
    }
  }


  // ========================================
  // CHECK OUT
  // ========================================
  async function handleCheckOut() {
    if (checkOutLoading) {
      return;
    }

    try {
      setCheckOutLoading(true);
      setAttendanceError("");

      const response =
        await client.post(
          "/attendance/check-out/"
        );

      if (
        response.data?.attendance
      ) {
        setAttendance(
          response.data.attendance
        );
      } else {
        await loadTodayAttendance();
      }
    } catch (error) {
      console.error(
        "Check out error:",
        error
      );

      setAttendanceError(
        error?.response?.data
          ?.detail ||
          "Unable to check out."
      );
    } finally {
      setCheckOutLoading(false);
    }
  }


  // ========================================
  // CLEAR SESSION TIMERS
  // ========================================
  const clearSessionTimers =
    useCallback(() => {

      if (
        warningTimerRef.current
      ) {
        clearTimeout(
          warningTimerRef.current
        );

        warningTimerRef.current =
          null;
      }


      if (
        countdownTimerRef.current
      ) {
        clearInterval(
          countdownTimerRef.current
        );

        countdownTimerRef.current =
          null;
      }

    }, []);


  // ========================================
  // MARK SESSION AS EXPIRED
  // ========================================
  const expireSession =
    useCallback(() => {

      clearSessionTimers();

      warningVisibleRef.current =
        true;

      sessionExpiredRef.current =
        true;

      setSessionSeconds(0);

      setSessionExpired(true);

      setShowSessionWarning(true);

    }, [clearSessionTimers]);


  // ========================================
  // START / RESET SESSION TIMER
  // ========================================
  const startSessionTimer =
    useCallback(() => {

      if (!user?.id) {
        return;
      }


      clearSessionTimers();


      // Reset states
      warningVisibleRef.current =
        false;

      sessionExpiredRef.current =
        false;

      setShowSessionWarning(false);

      setSessionExpired(false);

      setSessionSeconds(
        WARNING_SECONDS
      );


      // ====================================
      // AFTER 4 MINUTES:
      // SHOW SESSION EXPIRING
      // ====================================
      warningTimerRef.current =
        setTimeout(() => {

          warningVisibleRef.current =
            true;

          setShowSessionWarning(
            true
          );

          setSessionExpired(
            false
          );

          setSessionSeconds(
            WARNING_SECONDS
          );


          // ==================================
          // COUNTDOWN
          // 60 → 59 → ... → 0
          // ==================================
          countdownTimerRef.current =
            setInterval(() => {

              setSessionSeconds(
                (previous) => {

                  if (
                    previous <= 1
                  ) {

                    expireSession();

                    return 0;
                  }

                  return (
                    previous - 1
                  );
                }
              );

            }, 1000);

        }, WARNING_TIME);

    }, [
      user?.id,
      clearSessionTimers,
      expireSession,
    ]);


  // ========================================
  // USER ACTIVITY
  // ========================================
  useEffect(() => {

    if (!user?.id) {
      return;
    }


    // Start timer after login
    startSessionTimer();


    function handleActivity() {

      /*
        If warning is already visible,
        do NOT automatically reset.

        User must click:
        Stay Logged In
      */

      if (
        warningVisibleRef.current
      ) {
        return;
      }


      /*
        If session already expired,
        user cannot continue session.
      */

      if (
        sessionExpiredRef.current
      ) {
        return;
      }


      // Restart inactivity timer
      startSessionTimer();
    }


    const activityEvents = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "pointerdown",
    ];


    activityEvents.forEach(
      (eventName) => {

        window.addEventListener(
          eventName,
          handleActivity,
          {
            passive: true,
          }
        );

      }
    );


    return () => {

      activityEvents.forEach(
        (eventName) => {

          window.removeEventListener(
            eventName,
            handleActivity
          );

        }
      );


      clearSessionTimers();
    };

  }, [
    user?.id,
    startSessionTimer,
    clearSessionTimers,
  ]);


  // ========================================
  // STAY LOGGED IN
  // ========================================
  function handleStayLoggedIn() {

    // If expired, cannot continue
    if (sessionExpired) {
      return;
    }


    warningVisibleRef.current =
      false;

    sessionExpiredRef.current =
      false;


    setShowSessionWarning(
      false
    );

    setSessionExpired(
      false
    );

    setSessionSeconds(
      WARNING_SECONDS
    );


    // Restart full inactivity time
    startSessionTimer();
  }


  // ========================================
  // MANUAL LOGOUT
  // ========================================
  async function handleManualLogout() {

    clearSessionTimers();

    warningVisibleRef.current =
      false;

    sessionExpiredRef.current =
      false;


    setShowSessionWarning(
      false
    );

    setSessionExpired(
      false
    );


    await logoutRef.current();
  }


  // ========================================
  // FORMAT TIME
  // ========================================
  function formatTime(value) {

    if (!value) {
      return "";
    }


    const date =
      new Date(value);


    return date.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }


  // ========================================
  // ATTENDANCE STATUS
  // ========================================
  const checkedIn =
    attendance?.check_in &&
    !attendance?.check_out;


  const checkedOut =
    Boolean(
      attendance?.check_out
    );


  // ========================================
  // PAGE
  // ========================================
  return (
    <div className="app-shell">

      {/* ==================================
          SIDEBAR
      ================================== */}
      <aside
        className="sidebar scrollbar-thin"
      >

        {/* BRAND */}
        <div className="brand">

          <div className="brand-logo">
            EMS
          </div>

          <div>

            <strong>
              Employee
            </strong>

            <small>
              Management System
            </small>

          </div>

        </div>


        {/* ==================================
            NAVIGATION
        ================================== */}
        <nav className="side-nav">

          {nav.map((item) => (

            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}

              className={({
                isActive,
              }) =>
                `side-link ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
            >

              <span
                className="side-icon"
              >
                {icons[
                  item.label
                ] || "•"}
              </span>


              <span>
                {item.label}
              </span>

            </NavLink>

          ))}

        </nav>


        {/* ==================================
            USER PROFILE
        ================================== */}
        <div className="side-profile">

          <div className="avatar">

            {(user?.username ||
              "U")
              .slice(0, 2)
              .toUpperCase()}

          </div>


          <div
            className="profile-copy"
          >

            <strong>
              {user?.username ||
                "User"}
            </strong>


            <small>

              {user?.role_label ||
                role}


              {user?.department_name
                ? ` · ${user.department_name}`
                : ""}

            </small>

          </div>


          {/* LOGOUT */}
          <button
            className="logout-icon"
            onClick={
              handleManualLogout
            }
            title="Log out"
          >
            ↪
          </button>

        </div>

      </aside>


      {/* ==================================
          WORKSPACE
      ================================== */}
      <section className="workspace">

        {/* TOPBAR */}
        <header className="topbar">

          <button
            className="menu-button"
            aria-label="Menu"
          >
            ☰
          </button>


          <div
            className="topbar-right"
          >

            {/* ==============================
                ATTENDANCE
            ============================== */}
            {(role === "employee" || hasPermission("view_attendance")) && (
            <div
              className="attendance-status"
            >

              {attendanceLoading ? (

                <span
                  className="attendance-muted"
                >
                  Loading attendance...
                </span>

              ) : checkedOut ? (

                <span
                  className="attendance-checked-out"
                >
                  Checked out:{" "}

                  <strong>

                    {formatTime(
                      attendance
                        .check_out
                    )}

                  </strong>

                </span>

              ) : checkedIn ? (

                <>

                  <span
                    className="attendance-checked-in"
                  >
                    Checked in:{" "}

                    <strong>

                      {formatTime(
                        attendance
                          .check_in
                      )}

                    </strong>

                  </span>


                  <button
                    type="button"
                    className="attendance-checkout-btn"
                    onClick={
                      handleCheckOut
                    }
                    disabled={
                      checkOutLoading
                    }
                  >

                    {checkOutLoading
                      ? "Checking Out..."
                      : "Check Out"}

                  </button>

                </>

              ) : (

                <span
                  className="attendance-muted"
                >
                  No attendance today
                </span>

              )}


              {attendanceError && (

                <span
                  className="attendance-error"
                >
                  {attendanceError}
                </span>

              )}

            </div>
            )}


            {/* TOP USER */}
            <div className="top-user">

              <div
                className="avatar small"
              >

                {(user?.username ||
                  "U")
                  .slice(0, 2)
                  .toUpperCase()}

              </div>

            </div>

          </div>

        </header>


        {/* ==================================
            PAGE CONTENT
        ================================== */}
        <main className="page-area">
          <Outlet />
        </main>

      </section>


      {/* ==================================
          SESSION MODAL
      ================================== */}
      {showSessionWarning && (

        <div
          style={{
            position: "fixed",
            inset: 0,

            background:
              "rgba(15, 23, 42, 0.55)",

            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            padding: "20px",

            zIndex: 99999,
          }}
        >

          <div
            style={{
              width: "430px",
              maxWidth: "100%",

              background:
                "#ffffff",

              borderRadius:
                "18px",

              padding:
                "28px",

              boxShadow:
                "0 25px 70px rgba(0,0,0,0.25)",
            }}
          >


            {/* ==============================
                ICON
            ============================== */}
            <div
              style={{
                width: "52px",
                height: "52px",

                borderRadius:
                  "50%",

                display:
                  "grid",

                placeItems:
                  "center",

                background:
                  sessionExpired
                    ? "#fee2e2"
                    : "#fff4e5",

                color:
                  sessionExpired
                    ? "#dc2626"
                    : "#d97706",

                fontSize:
                  "24px",

                fontWeight:
                  800,

                marginBottom:
                  "16px",
              }}
            >

              {sessionExpired
                ? "!"
                : "⏱"}

            </div>


            {/* ==============================
                TITLE
            ============================== */}
            <h2
              style={{
                margin: 0,

                marginBottom:
                  "10px",

                color:
                  sessionExpired
                    ? "#b91c1c"
                    : "#0f172a",
              }}
            >

              {sessionExpired
                ? "Session Expired"
                : "Session Expiring"}

            </h2>


            {/* ==============================
                MESSAGE
            ============================== */}
            <p
              style={{
                margin: 0,

                marginBottom:
                  sessionExpired
                    ? "22px"
                    : "15px",

                color:
                  "#64748b",

                lineHeight:
                  1.6,
              }}
            >

              {sessionExpired
                ? "Your session has expired due to inactivity. Please log out and sign in again."
                : "You have been inactive for 4 minutes. For security, your session will expire in:"}

            </p>


            {/* ==============================
                COUNTDOWN
            ============================== */}
            {!sessionExpired && (

              <div
                style={{
                  fontSize:
                    "38px",

                  fontWeight:
                    800,

                  color:
                    "#0f172a",

                  marginBottom:
                    "22px",
                }}
              >

                0:
                {String(
                  sessionSeconds
                ).padStart(
                  2,
                  "0"
                )}

              </div>

            )}


            {/* ==============================
                BUTTONS
            ============================== */}
            <div
              style={{
                display:
                  "flex",

                gap:
                  "10px",

                justifyContent:
                  "flex-end",

                flexWrap:
                  "wrap",
              }}
            >


              {/* ============================
                  SESSION EXPIRED
              ============================ */}
              {sessionExpired ? (

                <button
                  type="button"

                  onClick={
                    handleManualLogout
                  }

                  style={{
                    border:
                      "none",

                    background:
                      "#dc2626",

                    color:
                      "#ffffff",

                    padding:
                      "11px 22px",

                    borderRadius:
                      "9px",

                    cursor:
                      "pointer",

                    fontWeight:
                      600,
                  }}
                >
                  Logout
                </button>

              ) : (

                <>
                  {/* ========================
                      LOGOUT NOW
                  ======================== */}
                  <button
                    type="button"

                    onClick={
                      handleManualLogout
                    }

                    style={{
                      border:
                        "1px solid #cbd5e1",

                      background:
                        "#ffffff",

                      color:
                        "#334155",

                      padding:
                        "10px 16px",

                      borderRadius:
                        "9px",

                      cursor:
                        "pointer",

                      fontWeight:
                        600,
                    }}
                  >
                    Logout Now
                  </button>


                  {/* ========================
                      STAY LOGGED IN
                  ======================== */}
                  <button
                    type="button"

                    onClick={
                      handleStayLoggedIn
                    }

                    style={{
                      border:
                        "none",

                      background:
                        "#2563eb",

                      color:
                        "#ffffff",

                      padding:
                        "10px 16px",

                      borderRadius:
                        "9px",

                      cursor:
                        "pointer",

                      fontWeight:
                        600,
                    }}
                  >
                    Stay Logged In
                  </button>

                </>

              )}

            </div>

          </div>

        </div>

      )}

    </div>
  );
}