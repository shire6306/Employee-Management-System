import {
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { client } from "../api/client";
import Modal from "../components/Modal.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  job_title: "",
  department: "",
  status: "active",
  date_hired: "",
  leave_balance: 20,

  emergency_contact_name: "",
  emergency_contact_relationship: "",
  emergency_contact_phone: "",
};

const STATUS_LABEL = {
  active: "Active",
  on_leave: "On leave",
  inactive: "Inactive",
};

export default function Employees() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();

  const canAddEmployee = hasPermission("add_employee");
  const canEditEmployee = hasPermission("edit_employee");
  const canDeleteEmployee = hasPermission("delete_employee");

  const hasEmployeeManagementPermission =
    canAddEmployee || canEditEmployee || canDeleteEmployee;

  const isDepartmentManager =
    user?.role === "department_manager";

  const isEmployee =
    user?.role === "employee";

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  // =========================
  // LOAD DEPARTMENTS
  // =========================

  useEffect(() => {
    client
      .get("/departments/", {
        params: {
          ordering: "name",
        },
      })
      .then(({ data }) => {
        setDepartments(data.results ?? data);
      });
  }, []);

  // =========================
  // LOAD EMPLOYEES
  // =========================

  async function load() {
    setLoading(true);

    try {
      const { data } = await client.get(
        "/employees/",
        {
          params: isEmployee && !hasEmployeeManagementPermission
            ? {}
            : {
                search:
                  search || undefined,

                department:
                  deptFilter || undefined,

                status:
                  statusFilter || undefined,

                page,
              },
        }
      );

      if (data.results) {
        setEmployees(data.results);
        setCount(data.count);
        setHasNext(Boolean(data.next));
      } else {
        setEmployees(data);
        setCount(data.length);
        setHasNext(false);
      }
    } catch (err) {
      console.error(
        "Could not load employees:",
        err
      );

      setEmployees([]);
      setCount(0);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(
      load,
      250
    );

    return () =>
      clearTimeout(timer);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search,
    deptFilter,
    statusFilter,
    page,
    user?.role,
    hasEmployeeManagementPermission,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    deptFilter,
    statusFilter,
  ]);

  // =========================
  // CREATE EMPLOYEE
  // =========================

  function openCreate() {
    setEditing(null);

    setForm({
      ...EMPTY_FORM,
    });

    setError("");
    setModalOpen(true);
  }

  // =========================
  // EDIT EMPLOYEE
  // =========================

  function openEdit(emp) {
    setEditing(emp);

    setForm({
      first_name:
        emp.first_name || "",

      last_name:
        emp.last_name || "",

      email:
        emp.email || "",

      phone:
        emp.phone || "",

      job_title:
        emp.job_title || "",

      department:
        emp.department ?? "",

      status:
        emp.status || "active",

      date_hired:
        emp.date_hired ?? "",

      leave_balance:
        emp.leave_balance ?? 30,

      emergency_contact_name:
        emp.emergency_contact_name || "",

      emergency_contact_relationship:
        emp.emergency_contact_relationship || "",

      emergency_contact_phone:
        emp.emergency_contact_phone || "",
    });

    setError("");
    setModalOpen(true);
  }

  // =========================
  // SAVE EMPLOYEE
  // =========================

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");

    const payload = {
      ...form,

      department:
        form.department || null,

      date_hired:
        form.date_hired || null,

      leave_balance:
        Number(form.leave_balance) || 0,

      emergency_contact_name:
        form.emergency_contact_name.trim(),

      emergency_contact_relationship:
        form.emergency_contact_relationship.trim(),

      emergency_contact_phone:
        form.emergency_contact_phone.trim(),
    };

    try {
      if (editing) {
        await client.patch(
          `/employees/${editing.id}/`,
          payload
        );
      } else {
        await client.post(
          "/employees/",
          payload
        );
      }

      setModalOpen(false);
      setEditing(null);

      await load();
    } catch (err) {
      const data =
        err.response?.data;

      console.error(
        "Employee save error:",
        data
      );

      if (data) {
        const firstError =
          Object.values(data)[0];

        setError(
          Array.isArray(firstError)
            ? firstError[0]
            : typeof firstError === "string"
            ? firstError
            : "Could not save this employee."
        );
      } else {
        setError(
          "Could not save this employee."
        );
      }
    }
  }

  // =========================
  // DELETE EMPLOYEE
  // =========================

  async function handleDelete(emp) {
    const confirmed = confirm(
      `Remove ${emp.full_name}?`
    );

    if (!confirmed) return;

    try {
      await client.delete(
        `/employees/${emp.id}/`
      );

      await load();
    } catch (err) {
      console.error(
        "Could not delete employee:",
        err
      );

      alert(
        err.response?.data?.detail ||
          "Could not delete employee."
      );
    }
  }

  // =========================
  // EMPLOYEE: MY PROFILE
  // =========================

  if (isEmployee && !hasEmployeeManagementPermission) {
    const emp = employees[0];

    if (loading) {
      return (
        <div>
          Loading profile…
        </div>
      );
    }

    if (!emp) {
      return (
        <div
          className="card"
          style={{
            padding: "1.4rem",
          }}
        >
          <h1
            style={{
              fontSize: "1.5rem",
              marginBottom: 8,
            }}
          >
            My Profile
          </h1>

          <p
            style={{
              color:
                "var(--ink-soft)",
            }}
          >
            No employee profile is
            linked to this account.
          </p>
        </div>
      );
    }

    navigate(
      `/employees/${emp.id}`,
      {
        replace: true,
      }
    );

    return (
      <div>
        Opening profile…
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
      {/* HEADER */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.5rem",
            }}
          >
            Employees
          </h1>

          <p
            style={{
              color:
                "var(--ink-soft)",
              fontSize: "0.9rem",
              marginTop: "0.25rem",
            }}
          >
            {count}{" "}
            {count === 1
              ? "employee"
              : "employees"}{" "}
            on record.
          </p>
        </div>

        {canAddEmployee && (
          <button
            className="btn btn-primary"
            onClick={openCreate}
          >
            + New employee
          </button>
        )}
      </div>

      {/* FILTERS */}

      <div
        style={{
          display: "flex",
          gap: "0.7rem",
          flexWrap: "wrap",
        }}
      >
        <input
          placeholder="Search by name, email, or title…"
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
          style={{
            minWidth: 240,
            flex: "1 1 240px",
          }}
        />

        {!isDepartmentManager && (
          <select
            value={deptFilter}
            onChange={(e) =>
              setDeptFilter(
                e.target.value
              )
            }
          >
            <option value="">
              All departments
            </option>

            {departments.map(
              (department) => (
                <option
                  key={
                    department.id
                  }
                  value={
                    department.id
                  }
                >
                  {
                    department.name
                  }
                </option>
              )
            )}
          </select>
        )}

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value
            )
          }
        >
          <option value="">
            All statuses
          </option>

          {Object.entries(
            STATUS_LABEL
          ).map(
            ([key, value]) => (
              <option
                key={key}
                value={key}
              >
                {value}
              </option>
            )
          )}
        </select>
      </div>

      {/* EMPLOYEE TABLE */}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Title</th>
              <th>
                Department
              </th>
              <th>Status</th>
              <th>Hired</th>
              <th>
                Leave balance
              </th>

              <th
                style={{
                  width: 140,
                }}
              />
            </tr>
          </thead>

          <tbody>
            {employees.map(
              (emp) => (
                <tr
                  key={emp.id}
                  onClick={() => {
                    if (
                      hasPermission("view_employee")
                    ) {
                      navigate(
                        `/employees/${emp.id}`
                      );
                    }
                  }}
                  style={{
                    cursor:
                      hasPermission("view_employee")
                        ? "pointer"
                        : "default",
                  }}
                  title={
                    hasPermission("view_employee")
                      ? "Open employee profile"
                      : undefined
                  }
                >
                  <td>
                    <div
                      style={{
                        fontWeight:
                          700,

                        color:
                          hasPermission("view_employee")
                            ? "var(--brand)"
                            : "var(--ink)",
                      }}
                    >
                      {
                        emp.full_name
                      }
                    </div>

                    <div
                      style={{
                        fontSize:
                          "0.78rem",

                        color:
                          "var(--ink-soft)",
                      }}
                    >
                      {emp.email}
                    </div>
                  </td>

                  <td>
                    {emp.job_title ||
                      "—"}
                  </td>

                  <td>
                    {emp.department_name ||
                      "—"}
                  </td>

                  <td>
                    <span
                      className={`badge badge-${emp.status}`}
                    >
                      {
                        STATUS_LABEL[
                          emp.status
                        ]
                      }
                    </span>
                  </td>

                  <td>
                    {emp.date_hired ||
                      "—"}
                  </td>

                  <td>
                    {
                      emp.leave_balance
                    }{" "}
                    days
                  </td>

                  <td>
                    {(canEditEmployee || canDeleteEmployee) && (
                      <div
                        style={{
                          display:
                            "flex",

                          gap:
                            "0.4rem",

                          justifyContent:
                            "flex-end",
                        }}
                      >
                        {canEditEmployee && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(emp);
                            }}
                          >
                            Edit
                          </button>
                        )}

                        {canDeleteEmployee && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(emp);
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            )}

            {!loading &&
              employees.length ===
                0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      color:
                        "var(--ink-soft)",
                    }}
                  >
                    No employees
                    match these
                    filters.
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "flex-end",
          gap: "0.5rem",
          alignItems: "center",
        }}
      >
        <button
          className="btn btn-ghost btn-sm"
          disabled={page <= 1}
          onClick={() =>
            setPage(
              (current) =>
                current - 1
            )
          }
        >
          ← Prev
        </button>

        <span
          style={{
            fontSize: "0.8rem",
            color:
              "var(--ink-soft)",
          }}
        >
          Page {page}
        </span>

        <button
          className="btn btn-ghost btn-sm"
          disabled={!hasNext}
          onClick={() =>
            setPage(
              (current) =>
                current + 1
            )
          }
        >
          Next →
        </button>
      </div>

      {/* CREATE / EDIT MODAL */}

      {modalOpen &&
        ((editing && canEditEmployee) ||
          (!editing && canAddEmployee)) && (
          <Modal
            title={
              editing
                ? "Edit employee"
                : "New employee"
            }
            onClose={() =>
              setModalOpen(false)
            }
            width={560}
          >
            <form
              onSubmit={
                handleSubmit
              }
              style={{
                display: "flex",
                flexDirection:
                  "column",
                gap: "0.85rem",
              }}
            >
              {/* NAME */}

              <div
                style={{
                  display: "flex",
                  gap: "0.7rem",
                }}
              >
                <div
                  className="field"
                  style={{
                    flex: 1,
                  }}
                >
                  <label>
                    First name
                  </label>

                  <input
                    value={
                      form.first_name
                    }
                    onChange={(
                      e
                    ) =>
                      setForm({
                        ...form,
                        first_name:
                          e.target
                            .value,
                      })
                    }
                    required
                    autoFocus
                  />
                </div>

                <div
                  className="field"
                  style={{
                    flex: 1,
                  }}
                >
                  <label>
                    Last name
                  </label>

                  <input
                    value={
                      form.last_name
                    }
                    onChange={(
                      e
                    ) =>
                      setForm({
                        ...form,
                        last_name:
                          e.target
                            .value,
                      })
                    }
                    required
                  />
                </div>
              </div>

              {/* EMAIL */}

              <div className="field">
                <label>
                  Email
                </label>

                <input
                  type="email"
                  value={
                    form.email
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      email:
                        e.target
                          .value,
                    })
                  }
                  required
                />
              </div>

              {/* PHONE / TITLE */}

              <div
                style={{
                  display: "flex",
                  gap: "0.7rem",
                }}
              >
                <div
                  className="field"
                  style={{
                    flex: 1,
                  }}
                >
                  <label>
                    Phone
                  </label>

                  <input
                    value={
                      form.phone
                    }
                    onChange={(
                      e
                    ) =>
                      setForm({
                        ...form,
                        phone:
                          e.target
                            .value,
                      })
                    }
                  />
                </div>

                <div
                  className="field"
                  style={{
                    flex: 1,
                  }}
                >
                  <label>
                    Job title
                  </label>

                  <input
                    value={
                      form.job_title
                    }
                    onChange={(
                      e
                    ) =>
                      setForm({
                        ...form,
                        job_title:
                          e.target
                            .value,
                      })
                    }
                  />
                </div>
              </div>

              {/* DEPARTMENT / STATUS */}

              <div
                style={{
                  display: "flex",
                  gap: "0.7rem",
                }}
              >
                <div
                  className="field"
                  style={{
                    flex: 1,
                  }}
                >
                  <label>
                    Department
                  </label>

                  <select
                    value={
                      form.department
                    }
                    onChange={(
                      e
                    ) =>
                      setForm({
                        ...form,
                        department:
                          e.target
                            .value,
                      })
                    }
                  >
                    <option value="">
                      Unassigned
                    </option>

                    {departments.map(
                      (
                        department
                      ) => (
                        <option
                          key={
                            department.id
                          }
                          value={
                            department.id
                          }
                        >
                          {
                            department.name
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div
                  className="field"
                  style={{
                    flex: 1,
                  }}
                >
                  <label>
                    Status
                  </label>

                  <select
                    value={
                      form.status
                    }
                    onChange={(
                      e
                    ) =>
                      setForm({
                        ...form,
                        status:
                          e.target
                            .value,
                      })
                    }
                  >
                    {Object.entries(
                      STATUS_LABEL
                    ).map(
                      ([
                        key,
                        value,
                      ]) => (
                        <option
                          key={
                            key
                          }
                          value={
                            key
                          }
                        >
                          {
                            value
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {/* DATE / LEAVE */}

              <div
                style={{
                  display: "flex",
                  gap: "0.7rem",
                }}
              >
                <div
                  className="field"
                  style={{
                    flex: 1,
                  }}
                >
                  <label>
                    Date hired
                  </label>

                  <input
                    type="date"
                    value={
                      form.date_hired ||
                      ""
                    }
                    onChange={(
                      e
                    ) =>
                      setForm({
                        ...form,
                        date_hired:
                          e.target
                            .value,
                      })
                    }
                  />
                </div>

                <div
                  className="field"
                  style={{
                    flex: 1,
                  }}
                >
                  <label>
                    Leave balance
                    (days)
                  </label>

                  <input
                    type="number"
                    min={0}
                    value={
                      form.leave_balance
                    }
                    onChange={(
                      e
                    ) =>
                      setForm({
                        ...form,
                        leave_balance:
                          e.target
                            .value,
                      })
                    }
                  />
                </div>
              </div>

              {/* =========================
                  EMERGENCY CONTACT
              ========================= */}

              <div
                style={{
                  borderTop:
                    "1px solid var(--line)",

                  paddingTop:
                    "1rem",

                  marginTop:
                    "0.2rem",
                }}
              >
                <div
                  style={{
                    fontSize:
                      "0.95rem",

                    fontWeight:
                      700,

                    color:
                      "var(--ink)",

                    marginBottom:
                      "0.8rem",
                  }}
                >
                  🚨 Emergency
                  Contact
                </div>

                {/* CONTACT NAME */}

                <div className="field">
                  <label>
                    Contact name
                  </label>

                  <input
                    value={
                      form.emergency_contact_name
                    }
                    onChange={(
                      e
                    ) =>
                      setForm({
                        ...form,

                        emergency_contact_name:
                          e.target
                            .value,
                      })
                    }
                    placeholder="Emergency contact full name"
                  />
                </div>

                {/* RELATIONSHIP / PHONE */}

                <div
                  style={{
                    display:
                      "flex",

                    gap:
                      "0.7rem",

                    marginTop:
                      "0.7rem",
                  }}
                >
                  <div
                    className="field"
                    style={{
                      flex: 1,
                    }}
                  >
                    <label>
                      Relationship
                    </label>

                    <input
                      value={
                        form.emergency_contact_relationship
                      }
                      onChange={(
                        e
                      ) =>
                        setForm({
                          ...form,

                          emergency_contact_relationship:
                            e
                              .target
                              .value,
                        })
                      }
                      placeholder="e.g. Brother"
                    />
                  </div>

                  <div
                    className="field"
                    style={{
                      flex: 1,
                    }}
                  >
                    <label>
                      Emergency
                      phone
                    </label>

                    <input
                      value={
                        form.emergency_contact_phone
                      }
                      onChange={(
                        e
                      ) =>
                        setForm({
                          ...form,

                          emergency_contact_phone:
                            e
                              .target
                              .value,
                        })
                      }
                      placeholder="+252..."
                    />
                  </div>
                </div>
              </div>

              {/* ERROR */}

              {error && (
                <div
                  style={{
                    fontSize:
                      "0.82rem",

                    color:
                      "var(--rust)",
                  }}
                >
                  {error}
                </div>
              )}

              {/* BUTTONS */}

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "flex-end",
                  gap: "0.6rem",
                  marginTop:
                    "0.3rem",
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    setModalOpen(
                      false
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  {editing
                    ? "Save changes"
                    : "Add employee"}
                </button>
              </div>
            </form>
          </Modal>
        )}
    </div>
  );
}