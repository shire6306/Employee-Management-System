import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { client } from "../api/client";
import Modal from "../components/Modal.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const EMPTY_FORM = { name: "", description: "" };

export default function Departments() {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const navigate = useNavigate();

  const canAddDepartment = hasPermission("add_department");
  const canEditDepartment = hasPermission("edit_department");
  const canDeleteDepartment = hasPermission("delete_department");

  const hasDepartmentManagementPermission = hasAnyPermission([
    "add_department",
    "edit_department",
    "delete_department",
  ]);

  const isEmployee = user?.role === "employee";
  const usePersonalDepartmentMode =
    isEmployee && !hasDepartmentManagementPermission;

  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);

    try {
      const { data } = await client.get("/departments/", {
        params: {
          search: !usePersonalDepartmentMode && search ? search : undefined,
        },
      });

      let rows = data.results ?? data;

      // Extra frontend protection:
      // Employee sees only the department assigned to their account.
      if (usePersonalDepartmentMode && user?.department) {
        rows = rows.filter(
          (d) => String(d.id) === String(user.department)
        );
      }

      setDepartments(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, user?.department, user?.role, usePersonalDepartmentMode]);

  function openCreate() {
    if (!canAddDepartment) return;
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(true);
  }

  function openEdit(dept) {
    if (!canEditDepartment) return;
    setEditing(dept);
    setForm({
      name: dept.name,
      description: dept.description || "",
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (editing && !canEditDepartment) return;
    if (!editing && !canAddDepartment) return;

    try {
      if (editing) {
        await client.patch(`/departments/${editing.id}/`, form);
      } else {
        await client.post("/departments/", form);
      }

      setModalOpen(false);
      load();
    } catch (err) {
      setError(
        err.response?.data?.name?.[0] ||
          "Could not save this department."
      );
    }
  }

  async function handleDelete(dept) {
    if (!canDeleteDepartment) return;

    if (
      !confirm(
        `Delete "${dept.name}"? Employees in this department will become unassigned.`
      )
    ) {
      return;
    }

    await client.delete(`/departments/${dept.id}/`);
    load();
  }

  // =========================
  // EMPLOYEE: MY DEPARTMENT
  // =========================
  if (usePersonalDepartmentMode) {
    const dept = departments[0];

    if (loading) {
      return <div>Loading department…</div>;
    }

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.3rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem" }}>
            Department
          </h1>

          <p
            style={{
              color: "var(--ink-soft)",
              fontSize: "0.9rem",
              marginTop: "0.25rem",
            }}
          >
            View information about your assigned department.
          </p>
        </div>

        {!dept ? (
          <div
            className="card"
            style={{ padding: "1.4rem" }}
          >
            <p style={{ color: "var(--ink-soft)" }}>
              No department is assigned to your account.
            </p>
          </div>
        ) : (
          <div
            className="card"
            style={{ padding: "1.4rem" }}
          >
            <div
              style={{
                marginBottom: 22,
                paddingBottom: 18,
                borderBottom: "1px solid var(--line)",
              }}
            >
              <h2
                style={{
                  fontSize: "1.25rem",
                  marginBottom: 6,
                }}
              >
                {dept.name}
              </h2>

              <span
                style={{
                  color: "var(--ink-soft)",
                  fontSize: 14,
                }}
              >
                Your assigned department
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "1.4rem 2rem",
              }}
            >
              <Info
                label="Department"
                value={dept.name}
              />

              <Info
                label="Employees"
                value={dept.employee_count ?? 0}
              />

              <div
                style={{
                  gridColumn: "1 / -1",
                }}
              >
                <Info
                  label="Description"
                  value={dept.description}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================
  // ADMIN / GM / DEPT MANAGER
  // =========================
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
            Departments
          </h1>

          <p
            style={{
              color: "var(--ink-soft)",
              fontSize: "0.9rem",
              marginTop: "0.25rem",
            }}
          >
            Organize your employees into teams.
          </p>
        </div>

        {canAddDepartment && (
          <button
            className="btn btn-primary"
            onClick={openCreate}
          >
            + New department
          </button>
        )}
      </div>

      <input
        placeholder="Search departments…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 320 }}
      />

      {/* Department cards */}
      {loading ? (
        <div className="card" style={{ padding: "1.4rem" }}>Loading departments…</div>
      ) : departments.length === 0 ? (
        <div className="card" style={{ padding: "1.4rem", color: "var(--ink-soft)" }}>No departments found.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
          {departments.map((d) => (
            <div key={d.id} className="card"
              onClick={() => navigate(`/departments/${d.id}`)}
              style={{ padding: "1.25rem", cursor: "pointer", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div>
                <h3 style={{ fontSize: "1.05rem", marginBottom: 6 }}>{d.name}</h3>
                <p style={{ color: "var(--ink-soft)", fontSize: "0.88rem", lineHeight: 1.6 }}>
                  {d.description || "No description available."}
                </p>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: "0.85rem" }}>
                <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{d.employee_count ?? 0} Employees</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>View Department →</span>
              </div>
              {(canEditDepartment || canDeleteDepartment) && (
                <div style={{ display: "flex", gap: "0.4rem" }} onClick={(e) => e.stopPropagation()}>
                  {canEditDepartment && (
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(d)}>Edit</button>
                  )}
                  {canDeleteDepartment && (
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(d)}>Delete</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && ((editing && canEditDepartment) || (!editing && canAddDepartment)) && (
        <Modal
          title={
            editing
              ? "Edit department"
              : "New department"
          }
          onClose={() => setModalOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.9rem",
            }}
          >
            <div className="field">
              <label>Name</label>

              <input
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
                required
                autoFocus
              />
            </div>

            <div className="field">
              <label>Description</label>

              <textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description: e.target.value,
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
                {editing
                  ? "Save changes"
                  : "Create department"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          color: "var(--ink-soft)",
          marginBottom: 5,
        }}
      >
        {label}
      </div>

      <div style={{ fontWeight: 600 }}>
        {value || value === 0 ? value : "—"}
      </div>
    </div>
  );
}
