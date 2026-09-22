import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { client } from "../api/client";

export default function DepartmentDetails() {
  // ID-ga department-ka URL-ka kasoo qaado
  const { id } = useParams();

  // Page kale loogu wareego
  const navigate = useNavigate();

  // Department data
  const [department, setDepartment] = useState(null);

  // Employees-ka department-kan
  const [employees, setEmployees] = useState([]);

  // Loading
  const [loading, setLoading] = useState(true);

  // Error
  const [error, setError] = useState("");

  // =========================
  // LOAD DEPARTMENT
  // =========================
  useEffect(() => {
    async function loadDepartment() {
      setLoading(true);
      setError("");

      try {
        // Department details
        const departmentResponse = await client.get(
          `/departments/${id}/`
        );

        setDepartment(departmentResponse.data);

        // Employees
        const employeeResponse = await client.get(
          "/employees/"
        );

        const allEmployees =
          employeeResponse.data.results ??
          employeeResponse.data;

        // Department-kan employees-kiisa kaliya
        const departmentEmployees = allEmployees.filter(
          (employee) => {
            const departmentId =
              employee.department?.id ??
              employee.department_id ??
              employee.department;

            return String(departmentId) === String(id);
          }
        );

        setEmployees(departmentEmployees);
      } catch (err) {
        console.error(err);

        setError(
          "Could not load department information."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDepartment();
  }, [id]);

  // =========================
  // LOADING
  // =========================
  if (loading) {
    return (
      <div className="card" style={{ padding: "1.4rem" }}>
        Loading department…
      </div>
    );
  }

  // =========================
  // ERROR
  // =========================
  if (error) {
    return (
      <div className="card" style={{ padding: "1.4rem" }}>
        <p style={{ color: "var(--rust)" }}>
          {error}
        </p>
      </div>
    );
  }

  // =========================
  // PAGE
  // =========================
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.3rem",
      }}
    >
      {/* Back button */}
      <div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate("/departments")}
        >
          ← Back to Departments
        </button>
      </div>

      {/* =========================
          DEPARTMENT HEADER
      ========================== */}
      <div>
        <h1
          style={{
            fontSize: "1.6rem",
            marginBottom: 6,
          }}
        >
          {department?.name}
        </h1>

        <p
          style={{
            color: "var(--ink-soft)",
            fontSize: "0.9rem",
          }}
        >
          Department information and employees.
        </p>
      </div>

      {/* =========================
          DEPARTMENT INFO
      ========================== */}
      <div
        className="card"
        style={{
          padding: "1.4rem",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.4rem",
          }}
        >
          {/* Department Name */}
          <Info
            label="Department"
            value={department?.name}
          />

          {/* Number of employees */}
          <Info
            label="Employees"
            value={employees.length}
          />

          {/* Description */}
          <div
            style={{
              gridColumn: "1 / -1",
            }}
          >
            <Info
              label="Description"
              value={
                department?.description ||
                "No description available."
              }
            />
          </div>
        </div>
      </div>

      {/* =========================
          EMPLOYEES
      ========================== */}
      <div>
        <div
          style={{
            marginBottom: "0.8rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.2rem",
            }}
          >
            Employees
          </h2>

          <p
            style={{
              color: "var(--ink-soft)",
              fontSize: 13,
              marginTop: 4,
            }}
          >
            Employees assigned to this department.
          </p>
        </div>

        {/* No Employees */}
        {employees.length === 0 ? (
          <div
            className="card"
            style={{
              padding: "1.4rem",
            }}
          >
            <p
              style={{
                color: "var(--ink-soft)",
              }}
            >
              No employees found in this department.
            </p>
          </div>
        ) : (
          /* Employee Cards */
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1rem",
            }}
          >
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="card"

                // =========================
                // CLICK EMPLOYEE
                // =========================
                // Employee Profile page-ka geey
                onClick={() =>
                  navigate(
                    `/employees/${employee.id}`
                  )
                }

                style={{
                  padding: "1.1rem",
                  cursor: "pointer",
                }}
              >
                {/* Employee top */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.9rem",
                  }}
                >
                  {/* Employee Photo */}
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: "#edf4ff",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      fontWeight: 700,
                    }}
                  >
                    {employee.photo ? (
                      <img
                        src={employee.photo}
                        alt={employee.full_name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      employee.full_name
                        ?.charAt(0)
                        ?.toUpperCase() || "E"
                    )}
                  </div>

                  {/* Employee name */}
                  <div>
                    <h3
                      style={{
                        fontSize: "0.95rem",
                        marginBottom: 4,
                      }}
                    >
                      {employee.full_name}
                    </h3>

                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--ink-soft)",
                      }}
                    >
                      {employee.job_title ||
                        employee.position ||
                        "Employee"}
                    </p>
                  </div>
                </div>

                {/* Bottom */}
                <div
                  style={{
                    borderTop:
                      "1px solid var(--line)",
                    marginTop: "1rem",
                    paddingTop: "0.8rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--ink-soft)",
                    }}
                  >
                    View employee details
                  </span>

                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Profile →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ==============================
// REUSABLE INFO COMPONENT
// ==============================
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

      <div
        style={{
          fontWeight: 600,
        }}
      >
        {value || value === 0 ? value : "—"}
      </div>
    </div>
  );
}