import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { client } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import "./Dashboard.css";


function StatCard({
  title,
  value,
  subtitle,
  icon,
  type = "",
  onClick,
}) {
  return (
    <div
      className={`dashboard-stat-card ${type}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="dashboard-stat-card-top">
        <div className="dashboard-stat-icon">
          {icon}
        </div>

        <div className="dashboard-stat-value">
          {value ?? 0}
        </div>
      </div>

      <div className="dashboard-stat-content">
        <h3>{title}</h3>

        {subtitle && (
          <p>{subtitle}</p>
        )}
      </div>
    </div>
  );
}


function AttendanceBadge({ status }) {
  const labels = {
    present: "Present",
    late: "Late",
    absent: "Absent",
    on_leave: "On Leave",
    day_off: "Day Off",
  };

  return (
    <span
      className={`dashboard-attendance-badge ${status}`}
    >
      {labels[status] || status}
    </span>
  );
}


export default function Dashboard() {

  // =====================================================
  // AUTH + PERMISSIONS
  // =====================================================
  const {
    user,
    hasPermission,
  } = useAuth();

  const navigate = useNavigate();


  // =====================================================
  // PERMISSION FLAGS
  // =====================================================
  const canViewAttendance =
    hasPermission("view_attendance");

  const canViewEmployees =
    hasPermission("view_employee");

  const canViewDepartments =
    hasPermission("view_department");

  const canViewLeave =
    hasPermission("view_leave");

  const canViewTasks =
    hasPermission("view_task");


  // =====================================================
  // STATE
  // =====================================================
  const [stats, setStats] =
    useState(null);

  const [
    attendanceRecords,
    setAttendanceRecords,
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");


  // =====================================================
  // LOAD DASHBOARD
  // =====================================================
  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      // -----------------------------------------------
      // Dashboard statistics
      // -----------------------------------------------
      const statsResponse =
        await client.get("/stats/");

      setStats(
        statsResponse.data
      );


      // -----------------------------------------------
      // Attendance
      //
      // Do NOT request attendance if the user
      // does not have view_attendance.
      // -----------------------------------------------
      if (canViewAttendance) {
        try {
          const attendanceResponse =
            await client.get(
              "/attendance/"
            );

          const attendanceData =
            attendanceResponse.data;

          if (
            Array.isArray(
              attendanceData
            )
          ) {
            setAttendanceRecords(
              attendanceData
            );
          } else {
            setAttendanceRecords(
              attendanceData?.results ||
                []
            );
          }
        } catch (
          attendanceError
        ) {
          console.error(
            "Attendance dashboard load error:",
            attendanceError
          );

          setAttendanceRecords([]);
        }
      } else {
        setAttendanceRecords([]);
      }

    } catch (err) {
      console.error(
        "Dashboard load error:",
        err
      );

      setError(
        err?.response?.data?.detail ||
          "Dashboard data could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }


  // =====================================================
  // LOAD WHEN USER / PERMISSION CHANGES
  // =====================================================
  useEffect(() => {
    loadDashboard();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.id,
    canViewAttendance,
  ]);


  // =====================================================
  // ATTENDANCE STATS
  // =====================================================
  const attendance =
    stats?.attendance_today || {
      present: 0,
      late: 0,
      absent: 0,
      on_leave: 0,
      day_off: 0,
      total: 0,
    };


  // =====================================================
  // ATTENDANCE CARDS
  // =====================================================
  const attendanceCards = [
    {
      title: "Present",
      value:
        attendance.present ?? 0,
      subtitle:
        "On time today",
      icon: "✓",
      type: "present",
      onClick: () =>
        navigate(
          "/attendance?status=present"
        ),
    },

    {
      title: "Late",
      value:
        attendance.late ?? 0,
      subtitle:
        "Arrived after 8:15 AM",
      icon: "◷",
      type: "late",
      onClick: () =>
        navigate(
          "/attendance?status=late"
        ),
    },

    {
      title: "Absent",
      value:
        attendance.absent ?? 0,
      subtitle:
        "No check-in",
      icon: "✕",
      type: "absent",
      onClick: () =>
        navigate(
          "/attendance?status=absent"
        ),
    },

    {
      title: "On Leave",
      value:
        attendance.on_leave ?? 0,
      subtitle:
        "Approved leave",
      icon: "☂",
      type: "on-leave",
      onClick: () =>
        navigate(
          "/attendance?status=on_leave"
        ),
    },

    {
      title: "Day Off",
      value:
        attendance.day_off ?? 0,
      subtitle:
        "Friday",
      icon: "☕",
      type: "day-off",
      onClick: () =>
        navigate(
          "/attendance?status=day_off"
        ),
    },
  ];


  // =====================================================
  // TODAY ATTENDANCE TABLE
  // =====================================================
  const todayAttendance =
    useMemo(
      () => {
        if (
          !canViewAttendance ||
          !attendanceRecords.length
        ) {
          return [];
        }

        const now =
          new Date();

        const year =
          now.getFullYear();

        const month =
          String(
            now.getMonth() + 1
          ).padStart(2, "0");

        const day =
          String(
            now.getDate()
          ).padStart(2, "0");

        const today =
          `${year}-${month}-${day}`;

        return attendanceRecords.filter(
          (item) =>
            item.date === today
        );
      },
      [
        attendanceRecords,
        canViewAttendance,
      ]
    );


  // =====================================================
  // DATE FORMAT
  // =====================================================
  function formatDate(value) {
    if (!value) {
      return "—";
    }

    return new Date(
      `${value}T00:00:00`
    ).toLocaleDateString(
      undefined,
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  }


  // =====================================================
  // TIME FORMAT
  // =====================================================
  function formatTime(value) {
    if (!value) {
      return "—";
    }

    return new Date(
      value
    ).toLocaleTimeString(
      undefined,
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }


  // =====================================================
  // KEYBOARD NAVIGATION
  // =====================================================
  function handleCardKeyDown(
    event,
    path
  ) {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();

      navigate(path);
    }
  }


  // =====================================================
  // LOADING
  // =====================================================
  if (loading) {
    return (
      <div className="dashboard-page">

        <div className="dashboard-loading">
          Loading dashboard...
        </div>

      </div>
    );
  }


  // =====================================================
  // ERROR
  // =====================================================
  if (error) {
    return (
      <div className="dashboard-page">

        <div className="dashboard-error">

          <p>
            {error}
          </p>

          <button
            type="button"
            onClick={
              loadDashboard
            }
          >
            Try Again
          </button>

        </div>

      </div>
    );
  }


  // =====================================================
  // DASHBOARD
  // =====================================================
  return (
    <div className="dashboard-page">


      {/* =================================================
          HEADER

          Header-kaagii hore waan haynay.
          Weli commented ayuu ahaanayaa sidii
          original-kaaga.
      ================================================= */}

      {/*
      <div className="dashboard-header">

        <div>

          <p className="dashboard-eyebrow">
            Employee Management System
          </p>

          <h1>
            Welcome back
            {user?.first_name
              ? `, ${user.first_name}`
              : ""}
          </h1>

          <p className="dashboard-header-text">
            Here is today's workforce overview.
          </p>

        </div>


        <div className="dashboard-date">

          <span>
            Today
          </span>

          <strong>
            {new Date().toLocaleDateString(
              undefined,
              {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              }
            )}
          </strong>

        </div>

      </div>
      */}


      {/* =================================================
          ATTENDANCE SECTION

          Permission:
          view_attendance
      ================================================= */}

      {canViewAttendance && (

        <section className="dashboard-section">

          <div className="dashboard-section-header">

            <div>

              <h2>
                Today's Attendance
              </h2>

              <p>
                Work hours: 8:00 AM – 4:00 PM ·
                Late starts at 8:15 AM
              </p>

            </div>


            <div className="attendance-total">

              <span>
                Total Records
              </span>

              <strong>
                {attendance.total ?? 0}
              </strong>

            </div>

          </div>


          <div className="dashboard-attendance-grid">

            {attendanceCards.map(
              (card) => (

                <StatCard
                  key={
                    card.title
                  }
                  {...card}
                />

              )
            )}

          </div>

        </section>

      )}


      {/* =================================================
          COMPANY / PERSONAL STATS
      ================================================= */}

      <section className="dashboard-section">

        <div className="dashboard-section-header">

          <div>

            <h2>
              Overview
            </h2>

            <p>
              Workforce and task summary
            </p>

          </div>

        </div>


        <div className="dashboard-overview-grid">


          {/* =============================================
              EMPLOYEES

              Permission:
              view_employee
          ============================================= */}

          {canViewEmployees && (

            <div
              className="dashboard-info-card clickable-card"
              onClick={() =>
                navigate(
                  "/employees"
                )
              }
              role="button"
              tabIndex={0}
              onKeyDown={(event) =>
                handleCardKeyDown(
                  event,
                  "/employees"
                )
              }
            >

              <div>

                <span className="info-label">
                  Employees
                </span>

                <strong>
                  {stats?.total_employees ??
                    0}
                </strong>

              </div>


              <div className="info-icon">
                👥
              </div>

            </div>

          )}


          {/* =============================================
              DEPARTMENTS

              Permission:
              view_department
          ============================================= */}

          {canViewDepartments && (

            <div
              className="dashboard-info-card clickable-card"
              onClick={() =>
                navigate(
                  "/departments"
                )
              }
              role="button"
              tabIndex={0}
              onKeyDown={(event) =>
                handleCardKeyDown(
                  event,
                  "/departments"
                )
              }
            >

              <div>

                <span className="info-label">
                  Departments
                </span>

                <strong>
                  {stats?.total_departments ??
                    0}
                </strong>

              </div>


              <div className="info-icon">
                🏢
              </div>

            </div>

          )}


          {/* =============================================
              PENDING LEAVE

              Permission:
              view_leave
          ============================================= */}

          {canViewLeave && (

            <div
              className="dashboard-info-card clickable-card"
              onClick={() =>
                navigate(
                  "/leave-requests"
                )
              }
              role="button"
              tabIndex={0}
              onKeyDown={(event) =>
                handleCardKeyDown(
                  event,
                  "/leave-requests"
                )
              }
            >

              <div>

                <span className="info-label">
                  Pending Leave
                </span>

                <strong>
                  {stats?.pending_leave_requests ??
                    0}
                </strong>

              </div>


              <div className="info-icon">
                🗓
              </div>

            </div>

          )}


          {/* =============================================
              PENDING TASKS

              Permission:
              view_task
          ============================================= */}

          {canViewTasks && (

            <div
              className="dashboard-info-card clickable-card"
              onClick={() =>
                navigate(
                  "/tasks"
                )
              }
              role="button"
              tabIndex={0}
              onKeyDown={(event) =>
                handleCardKeyDown(
                  event,
                  "/tasks"
                )
              }
            >

              <div>

                <span className="info-label">
                  Pending Tasks
                </span>

                <strong>
                  {stats?.pending_tasks ??
                    0}
                </strong>

              </div>


              <div className="info-icon">
                ✓
              </div>

            </div>

          )}

        </div>

      </section>


      {/* =================================================
          TASKS

          Permission:
          view_task
      ================================================= */}

      {canViewTasks && (

        <section className="dashboard-section">

          <div className="dashboard-section-header">

            <div>

              <h2>
                Tasks
              </h2>

              <p>
                Department task progress
              </p>

            </div>

          </div>


          <div className="dashboard-task-grid">


            {/* PENDING */}

            <div
              className="task-summary-card pending clickable-card"
              onClick={() =>
                navigate(
                  "/tasks"
                )
              }
              role="button"
              tabIndex={0}
              onKeyDown={(event) =>
                handleCardKeyDown(
                  event,
                  "/tasks"
                )
              }
            >

              <span>
                Pending
              </span>

              <strong>
                {stats?.pending_tasks ??
                  0}
              </strong>

            </div>


            {/* IN PROGRESS */}

            <div
              className="task-summary-card progress clickable-card"
              onClick={() =>
                navigate(
                  "/tasks"
                )
              }
              role="button"
              tabIndex={0}
              onKeyDown={(event) =>
                handleCardKeyDown(
                  event,
                  "/tasks"
                )
              }
            >

              <span>
                In Progress
              </span>

              <strong>
                {stats?.in_progress_tasks ??
                  0}
              </strong>

            </div>


            {/* COMPLETED */}

            <div
              className="task-summary-card completed clickable-card"
              onClick={() =>
                navigate(
                  "/tasks"
                )
              }
              role="button"
              tabIndex={0}
              onKeyDown={(event) =>
                handleCardKeyDown(
                  event,
                  "/tasks"
                )
              }
            >

              <span>
                Completed
              </span>

              <strong>
                {stats?.completed_tasks ??
                  0}
              </strong>

            </div>


            {/* URGENT */}

            <div
              className="task-summary-card urgent clickable-card"
              onClick={() =>
                navigate(
                  "/tasks"
                )
              }
              role="button"
              tabIndex={0}
              onKeyDown={(event) =>
                handleCardKeyDown(
                  event,
                  "/tasks"
                )
              }
            >

              <span>
                Urgent
              </span>

              <strong>
                {stats?.urgent_tasks ??
                  0}
              </strong>

            </div>

          </div>

        </section>

      )}


      {/* =================================================
          TODAY ATTENDANCE LIST

          Permission:
          view_attendance
      ================================================= */}

      {canViewAttendance && (

        <section className="dashboard-section">

          <div className="dashboard-section-header">

            <div>

              <h2>
                Attendance Records
              </h2>

              <p>
                Today's employee attendance
              </p>

            </div>

          </div>


          <div
            className="dashboard-table-card clickable-card"
            onClick={() =>
              navigate(
                "/attendance"
              )
            }
            role="button"
            tabIndex={0}
            onKeyDown={(event) =>
              handleCardKeyDown(
                event,
                "/attendance"
              )
            }
          >

            {todayAttendance.length ===
            0 ? (

              <div className="dashboard-empty">

                No attendance records available.

              </div>

            ) : (

              <div className="dashboard-table-wrap">

                <table className="dashboard-table">

                  <thead>

                    <tr>

                      <th>
                        Employee
                      </th>

                      <th>
                        Department
                      </th>

                      <th>
                        Date
                      </th>

                      <th>
                        Check In
                      </th>

                      <th>
                        Check Out
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Hours
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {todayAttendance.map(
                      (record) => (

                        <tr
                          key={
                            record.id
                          }
                        >

                          <td>

                            <strong>
                              {
                                record.employee_name
                              }
                            </strong>

                          </td>


                          <td>
                            {record.department_name ||
                              "—"}
                          </td>


                          <td>
                            {formatDate(
                              record.date
                            )}
                          </td>


                          <td>
                            {formatTime(
                              record.check_in
                            )}
                          </td>


                          <td>
                            {formatTime(
                              record.check_out
                            )}
                          </td>


                          <td>

                            <AttendanceBadge
                              status={
                                record.status
                              }
                            />

                          </td>


                          <td>
                            {record.total_hours ??
                              "—"}
                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            )}

          </div>

        </section>

      )}


      {/* =================================================
          RECENT TASKS

          Permission:
          view_task
      ================================================= */}

      {canViewTasks && (

        <section className="dashboard-section">

          <div className="dashboard-section-header">

            <div>

              <h2>
                Recent Tasks
              </h2>

              <p>
                Latest department work
              </p>

            </div>

          </div>


          <div
            className="dashboard-list clickable-card"
            onClick={() =>
              navigate(
                "/tasks"
              )
            }
            role="button"
            tabIndex={0}
            onKeyDown={(event) =>
              handleCardKeyDown(
                event,
                "/tasks"
              )
            }
          >

            {stats?.recent_tasks?.length ? (

              stats.recent_tasks.map(
                (task) => (

                  <div
                    className="dashboard-list-item"
                    key={
                      task.id
                    }
                  >

                    <div>

                      <h4>
                        {task.title}
                      </h4>

                      <p>
                        {task.department_name ||
                          "No department"}
                      </p>

                    </div>


                    <div
                      className={
                        `dashboard-task-status ${task.status}`
                      }
                    >
                      {task.status
                        ?.replaceAll(
                          "_",
                          " "
                        )}
                    </div>

                  </div>

                )
              )

            ) : (

              <div className="dashboard-empty">

                No recent tasks.

              </div>

            )}

          </div>

        </section>

      )}

    </div>
  );
}