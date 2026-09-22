import { useEffect, useMemo, useState } from "react";
import { client } from "../api/client";
import Modal from "../components/Modal.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const EMPTY = {
  employee_id: "",
  username: "",
  password: "",
  first_name: "",
  last_name: "",
  email: "",
  role: "employee",
  department: "",
  phone: "",
  job_title: "",
};

export default function UserManagement() {
  const { user, hasPermission } = useAuth();

  const canAddUser = hasPermission("add_user");
  const canEditUser = hasPermission("edit_user");
  const canDeleteUser = hasPermission("delete_user");

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(EMPTY);

  const [open, setOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const { data } = await client.get("/users/");
    setUsers(data.results ?? data);
  };

  const loadEmployees = async () => {
    const { data } = await client.get("/employees/", {
      params: { page_size: 500 },
    });
    setEmployees(data.results ?? data);
  };

  useEffect(() => {
    load();

    client
      .get("/departments/", { params: { page_size: 200 } })
      .then(({ data }) => setDepartments(data.results ?? data));

    loadEmployees();
  }, []);

  function openCreateModal() {
    if (!canAddUser) return;
    setError("");
    setForm(EMPTY);
    setOpen(true);
  }

  function selectEmployee(employeeId) {
    const employee = employees.find(
      (item) => String(item.id) === String(employeeId)
    );

    if (!employee) {
      setForm((current) => ({
        ...current,
        employee_id: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        job_title: "",
        department: "",
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      employee_id: String(employee.id),
      first_name: employee.first_name ?? "",
      last_name: employee.last_name ?? "",
      email: employee.email ?? "",
      phone: employee.phone ?? "",
      job_title: employee.job_title ?? "",
      department: employee.department
        ? String(
            typeof employee.department === "object"
              ? employee.department.id
              : employee.department
          )
        : "",
    }));
  }

  function changeRole(role) {
    setError("");

    if (role === "general_manager") {
      setForm((current) => ({
        ...current,
        role,
        employee_id: "",
        department: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        job_title: "",
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      role,
      employee_id: "",
      department: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      job_title: "",
    }));
  }

  async function create(e) {
    e.preventDefault();
    if (!canAddUser) {
      setError("You do not have permission to create users.");
      return;
    }
    setError("");

    if (
      form.role !== "general_manager" &&
      !form.employee_id
    ) {
      setError("Please select an employee first.");
      return;
    }

    const payload = {
      username: form.username,
      password: form.password,
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone,
      job_title: form.job_title,
      role: form.role,
      department:
        form.role === "general_manager"
          ? null
          : form.department || null,
    };

    try {
      await client.post("/users/create-user/", payload);
      setOpen(false);
      setForm(EMPTY);
      await load();
      await loadEmployees();
    } catch (err) {
      const d = err.response?.data;
      setError(
        typeof d === "object"
          ? Object.values(d).flat().join(" ")
          : "Could not create user."
      );
    }
  }

  async function reset(e) {
    e.preventDefault();
    if (!canEditUser) {
      setError("You do not have permission to reset passwords.");
      return;
    }
    setError("");

    try {
      await client.post(`/users/${resetUser.id}/reset-password/`, {
        new_password: password,
      });
      setResetUser(null);
      setPassword("");
    } catch (err) {
      setError(
        Object.values(err.response?.data || {}).flat().join(" ") ||
          "Could not reset password."
      );
    }
  }

  async function deleteUser(targetUser) {
    if (!canDeleteUser) return;
    if (!confirm(`Delete user "${targetUser.username}"?`)) return;

    setError("");
    try {
      await client.delete(`/users/${targetUser.id}/`);
      await load();
    } catch (err) {
      const data = err.response?.data;
      setError(
        data?.detail ||
        Object.values(data || {}).flat().join(" ") ||
        "Could not delete user."
      );
    }
  }

  const selectedDepartmentName =
    departments.find(
      (department) => String(department.id) === String(form.department)
    )?.name || "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.2rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem" }}>User Management</h1>
          <p
            style={{
              color: "var(--ink-soft)",
              marginTop: 4,
            }}
          >
            Create Employee/Department Manager login accounts and reset
            passwords.
          </p>
        </div>

        {canAddUser && (
          <button
            className="btn btn-primary"
            onClick={openCreateModal}
          >
            + Create user
          </button>
        )}
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Role</th>
              <th>Department</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>
                  {u.first_name} {u.last_name}
                </td>
                <td>
                  <span className="badge badge-update">
                    {u.role?.replaceAll("_", " ")}
                  </span>
                </td>
                <td>{u.department_name || "—"}</td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    {canEditUser && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setError("");
                          setResetUser(u);
                        }}
                      >
                        Reset password
                      </button>
                    )}
                    {canDeleteUser && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteUser(u)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && canAddUser && (
        <Modal
          title="Create system user"
          onClose={() => setOpen(false)}
          width={650}
        >
          <form
            onSubmit={create}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: ".8rem",
            }}
          >
            <div
              className="field"
              style={{ gridColumn: "1 / -1" }}
            >
              <label>Role</label>
              <select
                value={form.role}
                onChange={(e) => changeRole(e.target.value)}
              >
                <option value="employee">Employee</option>
                <option value="department_manager">
                  Department Manager
                </option>
                {user?.role === "admin" && (
                  <option value="general_manager">
                    General Manager
                  </option>
                )}
              </select>
            </div>

            {form.role !== "general_manager" && (
              <div
                className="field"
                style={{ gridColumn: "1 / -1" }}
              >
                <label>Select Employee</label>
                <select
                  required
                  value={form.employee_id}
                  onChange={(e) => selectEmployee(e.target.value)}
                >
                  <option value="">Select employee...</option>
                  {employees.map((employee) => (
                    <option
                      key={employee.id}
                      value={employee.id}
                    >
                      {employee.first_name} {employee.last_name}
                      {employee.email
                        ? ` — ${employee.email}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="field">
              <label>First name</label>
              <input
                type="text"
                value={form.first_name}
                readOnly={form.role !== "general_manager"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    first_name: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="field">
              <label>Last name</label>
              <input
                type="text"
                value={form.last_name}
                readOnly={form.role !== "general_manager"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    last_name: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                readOnly={form.role !== "general_manager"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="field">
              <label>Phone</label>
              <input
                type="text"
                value={form.phone}
                readOnly={form.role !== "general_manager"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phone: e.target.value,
                  })
                }
              />
            </div>

            <div className="field">
              <label>Job title</label>
              <input
                type="text"
                value={form.job_title}
                readOnly={form.role !== "general_manager"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    job_title: e.target.value,
                  })
                }
              />
            </div>

            <div className="field">
              <label>Department</label>

              {form.role === "general_manager" ? (
                <input
                  value="Not required for General Manager"
                  disabled
                />
              ) : (
                <input
                  value={selectedDepartmentName}
                  placeholder="Select an employee"
                  readOnly
                />
              )}
            </div>

            <div className="field">
              <label>Username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) =>
                  setForm({
                    ...form,
                    username: e.target.value,
                  })
                }
                required
              />
            </div>

            <div
              className="field"
              style={{ gridColumn: "1 / -1" }}
            >
              <label>Temporary password</label>
              <input
                type="password"
                minLength={8}
                required
                value={form.password}
                onChange={(e) =>
                  setForm({
                    ...form,
                    password: e.target.value,
                  })
                }
              />
            </div>

            {error && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  color: "var(--rust)",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "end",
                gap: 8,
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>

              <button className="btn btn-primary">
                Create account
              </button>
            </div>
          </form>
        </Modal>
      )}

      {resetUser && canEditUser && (
        <Modal
          title={`Reset password — ${resetUser.username}`}
          onClose={() => setResetUser(null)}
        >
          <form
            onSubmit={reset}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div className="field">
              <label>New temporary password</label>
              <input
                autoFocus
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
              />
            </div>

            {error && (
              <div
                style={{
                  color: "var(--rust)",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <button className="btn btn-primary">
              Reset password
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}