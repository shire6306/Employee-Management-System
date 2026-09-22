import { useEffect, useState } from "react";
import { client } from "../api/client";
import Modal from "../components/Modal.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const STATUS_LABEL = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const TYPE_LABEL = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  unpaid: "Unpaid",
  other: "Other",
};

const EMPTY_FORM = {
  employee: "",
  leave_type: "vacation",
  start_date: "",
  end_date: "",
  reason: "",
};

export default function LeaveRequests() {
  const { user, hasPermission } = useAuth();

  const isEmployee = user?.role === "employee";

  // Exact leave permissions from the backend permission system.
  const canCreateLeave = hasPermission("create_leave");
  const canApproveLeave = hasPermission("approve_leave");
  const canRejectLeave = hasPermission("reject_leave");

  // The current permission catalog has no delete_leave permission.
  // Keep delete unavailable instead of incorrectly mapping it to create_leave.
  const canDelete = false;

  const canReview = canApproveLeave || canRejectLeave;

  // Employee stays in personal mode until a Leave management
  // permission is granted. When one is granted, this page behaves
  // like the management view without granting Employee/Profile access.
  const hasLeaveManagementPermission =
    canApproveLeave || canRejectLeave;

  const usePersonalLeaveMode =
    isEmployee && !hasLeaveManagementPermission;

  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [count, setCount] = useState(0);

  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [reviewingId, setReviewingId] = useState(null);

  useEffect(() => {
    // In Employee leave-management mode, use a dedicated minimal
    // leave endpoint. This returns only id/name/department label and
    // does NOT grant access to other employees' profiles.
    const endpoint =
      isEmployee && hasLeaveManagementPermission
        ? "/leave-requests/eligible-employees/"
        : "/employees/";

    client
      .get(endpoint, {
        params:
          endpoint === "/employees/"
            ? {
                page_size: 200,
                ordering: "last_name",
              }
            : undefined,
      })
      .then(({ data }) => {
        const rows = data.results ?? data;
        setEmployees(rows);
      })
      .catch(() => {
        setEmployees([]);
      });
  }, [
    user?.role,
    isEmployee,
    hasLeaveManagementPermission,
  ]);

  async function load() {
    setLoading(true);

    try {
      const { data } = await client.get("/leave-requests/", {
        params: {
          status: statusFilter || undefined,
          leave_type: typeFilter || undefined,
          search: !usePersonalLeaveMode && search ? search : undefined,
        },
      });

      const rows = data.results ?? data;
      setLeaves(rows);
      setCount(data.count ?? rows.length);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter, search, user?.role]);

  function openCreate() {
    if (!canCreateLeave) return;

    const ownEmployee = isEmployee ? employees[0] : null;

    setForm({
      ...EMPTY_FORM,
      employee: ownEmployee?.id ? String(ownEmployee.id) : "",
    });

    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!canCreateLeave) {
      setError("You do not have permission to create leave requests.");
      return;
    }

    setError("");

    const ownEmployee = isEmployee ? employees[0] : null;

    const payload = {
      ...form,
      employee: isEmployee
        ? ownEmployee?.id || form.employee
        : form.employee,
    };

    if (!payload.employee) {
      setError("No employee profile is linked to this account.");
      return;
    }

    try {
      await client.post("/leave-requests/", payload);
      setModalOpen(false);
      load();
    } catch (err) {
      const data = err.response?.data;
      const firstError = data && Object.values(data)[0];

      setError(
        Array.isArray(firstError)
          ? firstError[0]
          : firstError || "Could not submit this request."
      );
    }
  }

  async function handleReview(leave, action) {
    if (action === "approve" && !canApproveLeave) return;
    if (action === "reject" && !canRejectLeave) return;

    setReviewingId(leave.id);

    try {
      await client.post(`/leave-requests/${leave.id}/${action}/`, {});
      load();
    } finally {
      setReviewingId(null);
    }
  }

  async function handleDelete(leave) {
    if (!confirm("Delete this leave request?")) return;

    await client.delete(`/leave-requests/${leave.id}/`);
    load();
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.3rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem" }}>
            {"Leave Requests"}
          </h1>

          <p
            style={{
              color: "var(--ink-soft)",
              fontSize: "0.9rem",
              marginTop: "0.25rem",
            }}
          >
            {usePersonalLeaveMode
              ? `${count} ${count === 1 ? "request" : "requests"} submitted by you.`
              : `${count} ${count === 1 ? "request" : "requests"} on file.`}
          </p>
        </div>

        {canCreateLeave && (
          <button
            className="btn btn-primary"
            onClick={openCreate}
          >
            + New request
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.7rem",
          flexWrap: "wrap",
        }}
      >
        {!usePersonalLeaveMode && (
          <input
            placeholder="Search by employee or reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              minWidth: 240,
              flex: "1 1 240px",
            }}
          />
        )}

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              {!isEmployee && <th>Employee</th>}
              <th>Type</th>
              <th>Dates</th>
              <th>Days</th>
              <th>Reason</th>
              <th>Status</th>
              {(canReview || canDelete) && (
                <th style={{ width: 220 }}></th>
              )}
            </tr>
          </thead>

          <tbody>
            {leaves.map((lr) => (
              <tr key={lr.id}>
                {!usePersonalLeaveMode && (
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {lr.employee_name}
                    </div>

                    <div
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--ink-soft)",
                      }}
                    >
                      {lr.department_name || "—"}
                    </div>
                  </td>
                )}

                <td>{TYPE_LABEL[lr.leave_type] || lr.leave_type}</td>

                <td>
                  {lr.start_date} → {lr.end_date}
                </td>

                <td>{lr.days_requested}</td>

                <td
                  style={{
                    maxWidth: 260,
                    whiteSpace: "normal",
                    color: "var(--ink-soft)",
                  }}
                >
                  {lr.reason || "—"}
                </td>

                <td>
                  <span className={`badge badge-${lr.status}`}>
                    {STATUS_LABEL[lr.status] || lr.status}
                  </span>
                </td>

                {(canReview || canDelete) && (
                  <td>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.4rem",
                        justifyContent: "flex-end",
                      }}
                    >
                      {lr.status === "pending" && (
                        <>
                          {canApproveLeave && (
                            <button
                              className="btn btn-approve btn-sm"
                              disabled={reviewingId === lr.id}
                              onClick={() =>
                                handleReview(lr, "approve")
                              }
                            >
                              Approve
                            </button>
                          )}

                          {canRejectLeave && (
                            <button
                              className="btn btn-reject btn-sm"
                              disabled={reviewingId === lr.id}
                              onClick={() =>
                                handleReview(lr, "reject")
                              }
                            >
                              Reject
                            </button>
                          )}
                        </>
                      )}

                      {canDelete && lr.status !== "pending" && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(lr)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}

            {!loading && leaves.length === 0 && (
              <tr>
                <td
                  colSpan={
                    usePersonalLeaveMode
                      ? 5
                      : canReview || canDelete
                        ? 7
                        : 6
                  }
                  style={{ color: "var(--ink-soft)" }}
                >
                  {usePersonalLeaveMode
                    ? "You have no leave requests yet."
                    : "No leave requests match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && canCreateLeave && (
        <Modal
          title={
            usePersonalLeaveMode
              ? "New Leave Request"
              : "New leave request"
          }
          onClose={() => setModalOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.85rem",
            }}
          >
            {!isEmployee && (
              <div className="field">
                <label>Employee</label>

                <select
                  value={form.employee}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      employee: e.target.value,
                    })
                  }
                  required
                  autoFocus
                >
                  <option value="">
                    Select an employee…
                  </option>

                  {employees.map((emp) => (
                    <option
                      key={emp.id}
                      value={emp.id}
                    >
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {usePersonalLeaveMode && employees[0] && (
              <div
                style={{
                  padding: "0.8rem 0.9rem",
                  borderRadius: 8,
                  background: "var(--surface-soft, #f7f7f7)",
                  fontSize: 14,
                }}
              >
                Request for{" "}
                <strong>{employees[0].full_name}</strong>
              </div>
            )}

            <div className="field">
              <label>Leave type</label>

              <select
                value={form.leave_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    leave_type: e.target.value,
                  })
                }
                autoFocus={isEmployee}
              >
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.7rem",
              }}
            >
              <div
                className="field"
                style={{ flex: 1 }}
              >
                <label>Start date</label>

                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      start_date: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div
                className="field"
                style={{ flex: 1 }}
              >
                <label>End date</label>

                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      end_date: e.target.value,
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="field">
              <label>Reason</label>

              <textarea
                rows={3}
                value={form.reason}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reason: e.target.value,
                  })
                }
              />
            </div>

            {error && (
              <div
                style={{
                  fontSize: "0.82rem",
                  color: "var(--rust)",
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.6rem",
                marginTop: "0.3rem",
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
              >
                Submit request
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
