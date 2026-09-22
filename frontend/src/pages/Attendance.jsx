import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { client } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Attendance() {
  const { user, hasPermission } = useAuth();

  const canEditAttendance = hasPermission("edit_attendance");
  const [searchParams, setSearchParams] = useSearchParams();

  const initialStatus = searchParams.get("status") || "";
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const role = user?.role;
  const isEmployee = role === "employee";

  useEffect(() => {
    loadAttendance();
  }, []);

  async function loadAttendance() {
    try {
      setLoading(true);
      setError("");

      const response = await client.get("/attendance/");

      const data = response.data;

      setRecords(
        Array.isArray(data)
          ? data
          : data?.results || []
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.response?.data?.detail ||
          "Unable to load attendance."
      );
    } finally {
      setLoading(false);
    }
  }

  function formatDate(value) {
    if (!value) return "—";

    return new Date(
      `${value}T00:00:00`
    ).toLocaleDateString();
  }

  function formatTime(value) {
    if (!value) return "—";

    return new Date(value).toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  function formatHours(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "—";
    }

    const hours = Number(value);

    if (Number.isNaN(hours)) return "—";

    const wholeHours = Math.floor(hours);
    const minutes = Math.round(
      (hours - wholeHours) * 60
    );

    return `${wholeHours}h ${minutes}m`;
  }

  function getStatus(record) {
    const statusMap = {
      present: {
        label: "Present",
        className: "present",
      },
      late: {
        label: "Late",
        className: "late",
      },
      absent: {
        label: "Absent",
        className: "absent",
      },
      on_leave: {
        label: "On Leave",
        className: "on_leave",
      },
      day_off: {
        label: "Day Off",
        className: "day_off",
      },
    };

    if (statusMap[record.status]) {
      return statusMap[record.status];
    }

    if (record.check_in && !record.check_out) {
      return {
        label: "Working",
        className: "working",
      };
    }

    return {
      label: record.status_label || "Present",
      className: record.status || "present",
    };
  }

  const departments = useMemo(() => {
    const values = records
      .map((item) => item.department_name)
      .filter(Boolean);

    return [...new Set(values)].sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      const employeeName =
        item.employee_name?.toLowerCase() || "";

      const matchesSearch =
        !search ||
        employeeName.includes(
          search.toLowerCase()
        );

      const matchesDate =
        !dateFilter ||
        item.date === dateFilter;

      const matchesDepartment =
        !departmentFilter ||
        item.department_name ===
          departmentFilter;

      const matchesStatus =
        !statusFilter ||
        item.status === statusFilter;

      return (
        matchesSearch &&
        matchesDate &&
        matchesDepartment &&
        matchesStatus
      );
    });
  }, [
    records,
    search,
    dateFilter,
    departmentFilter,
    statusFilter,
  ]);

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const todayRecords = records.filter(
    (item) => item.date === today
  );

  const workingToday = todayRecords.filter(
    (item) =>
      item.check_in && !item.check_out
  ).length;

  const completedToday =
    todayRecords.filter(
      (item) => item.check_out
    ).length;

  return (
    <div
      className="attendance-page"
      data-can-edit-attendance={canEditAttendance ? "true" : "false"}
    >
      <div className="attendance-page-header">
        <div>
          <h1>
            {isEmployee
              ? "Attendance"
              : "Attendance"}
          </h1>

          <p>
            {isEmployee
              ? "View your attendance and working hours."
              : "Track employee check-ins, check-outs and working hours."}
          </p>
        </div>

        <button
          type="button"
          className="attendance-refresh"
          onClick={loadAttendance}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      <div className="attendance-summary-grid">
        <div className="attendance-summary-card">
          <span>Today Records</span>
          <strong>
            {todayRecords.length}
          </strong>
          <small>
            Attendance recorded today
          </small>
        </div>

        <div className="attendance-summary-card">
          <span>Currently Working</span>
          <strong>
            {workingToday}
          </strong>
          <small>
            Checked in, not checked out
          </small>
        </div>

        <div className="attendance-summary-card">
          <span>Checked Out</span>
          <strong>
            {completedToday}
          </strong>
          <small>
            Completed work today
          </small>
        </div>

        <div className="attendance-summary-card">
          <span>Total Records</span>
          <strong>
            {records.length}
          </strong>
          <small>
            Attendance history
          </small>
        </div>
      </div>

      <div className="attendance-panel">
        <div className="attendance-toolbar">
          <div className="attendance-search">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search employee..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />
          </div>

          <input
            type="date"
            className="attendance-filter"
            value={dateFilter}
            onChange={(e) =>
              setDateFilter(e.target.value)
            }
          />

          <select
            className="attendance-filter"
            value={statusFilter}
            onChange={(e) => {
              const value = e.target.value;
              setStatusFilter(value);

              const next = new URLSearchParams(searchParams);

              if (value) {
                next.set("status", value);
              } else {
                next.delete("status");
              }

              setSearchParams(next);
            }}
          >
            <option value="">All Statuses</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
            <option value="on_leave">On Leave</option>
            <option value="day_off">Day Off</option>
          </select>

          {!isEmployee &&
            departments.length > 0 && (
              <select
                className="attendance-filter"
                value={departmentFilter}
                onChange={(e) =>
                  setDepartmentFilter(
                    e.target.value
                  )
                }
              >
                <option value="">
                  All Departments
                </option>

                {departments.map(
                  (department) => (
                    <option
                      key={department}
                      value={department}
                    >
                      {department}
                    </option>
                  )
                )}
              </select>
            )}

          {(search ||
            dateFilter ||
            departmentFilter ||
            statusFilter) && (
            <button
              type="button"
              className="attendance-clear"
              onClick={() => {
                setSearch("");
                setDateFilter("");
                setDepartmentFilter("");
                setStatusFilter("");
                setSearchParams({});
              }}
            >
              Clear
            </button>
          )}
        </div>

        {error && (
          <div className="attendance-message error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="attendance-loading">
            Loading attendance...
          </div>
        ) : (
          <div className="attendance-table-wrap">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Total Hours</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="attendance-empty"
                    >
                      No attendance records
                      found.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(
                    (record) => {
                      const status =
                        getStatus(record);

                      return (
                        <tr key={record.id}>
                          <td>
                            <div className="attendance-employee">
                              <div className="attendance-avatar">
                                {(
                                  record.employee_name ||
                                  "E"
                                )
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>

                              <strong>
                                {record.employee_name ||
                                  "Employee"}
                              </strong>
                            </div>
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
                            <span className="attendance-time checkin">
                              {formatTime(
                                record.check_in
                              )}
                            </span>
                          </td>

                          <td>
                            <span className="attendance-time checkout">
                              {formatTime(
                                record.check_out
                              )}
                            </span>
                          </td>

                          <td>
                            {formatHours(
                              record.total_hours
                            )}
                          </td>

                          <td>
                            <span
                              className={`attendance-badge ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading &&
          filteredRecords.length > 0 && (
            <div className="attendance-table-footer">
              Showing{" "}
              <strong>
                {filteredRecords.length}
              </strong>{" "}
              attendance record
              {filteredRecords.length !== 1
                ? "s"
                : ""}
            </div>
          )}
      </div>
    </div>
  );
}