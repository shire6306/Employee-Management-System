import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const fileRef = useRef(null);

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const canManage = ["admin", "general_manager"].includes(user?.role);
  const isEmployee = user?.role === "employee";

  async function loadEmployee() {
    try {
      setLoading(true);
      setError("");

      const { data } = await client.get(`/employees/${id}/`);
      setEmployee(data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not load employee profile."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployee();
  }, [id]);

  async function uploadPhoto(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      alert("Please choose JPG, PNG or WEBP image.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be smaller than 2MB.");
      return;
    }

    const formData = new FormData();
    formData.append("photo", file);

    try {
      setUploading(true);

      const { data } = await client.patch(
        `/employees/${id}/`,
        formData
      );

      setEmployee(data);
    } catch (err) {
      alert(
        err.response?.data?.photo?.[0] ||
          err.response?.data?.detail ||
          "Could not upload photo."
      );
    } finally {
      setUploading(false);

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  if (loading) {
    return (
      <div className="employee-profile-loading">
        Loading employee profile...
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="employee-profile-error">
        <h2>Employee not found</h2>

        <p>{error}</p>

        {!isEmployee && (
          <button
            className="btn btn-primary"
            onClick={() => navigate("/employees")}
          >
            Back to Employees
          </button>
        )}
      </div>
    );
  }

  const initials =
    `${employee.first_name?.[0] || ""}${
      employee.last_name?.[0] || ""
    }`.toUpperCase();

  const statusText =
    employee.status === "active"
      ? "Active"
      : employee.status === "on_leave"
      ? "On Leave"
      : "Inactive";

  return (
    <div className="employee-profile-page">

      {/* HEADER */}
      <div className="employee-profile-page-title">
        <div>
          <div className="employee-profile-eyebrow">
            {isEmployee ? "" : "EMPLOYEE PROFILE"}
          </div>

          <h1>
            {isEmployee ? "Profile" : "Employee Profile"}
          </h1>

          <p>
            {isEmployee
              ? "Your personal and employment information."
              : "Employee information and details."}
          </p>
        </div>

        {!isEmployee && (
          <button
            className="employee-profile-back"
            onClick={() => navigate("/employees")}
          >
            ← Back to Employees
          </button>
        )}
      </div>

      {/* MAIN CARD */}
      <div className="employee-profile-card">

        <div className="employee-profile-cover" />

        <div className="employee-profile-content">

          {/* PHOTO */}
          <div className="employee-photo-section">

            <div className="employee-photo-wrap">

              {employee.photo ? (
                <img
                  src={employee.photo}
                  alt={employee.full_name}
                  className="employee-profile-photo"
                />
              ) : (
                <div className="employee-profile-photo employee-photo-placeholder">
                  {initials || "EMP"}
                </div>
              )}

              {canManage && (
                <button
                  type="button"
                  className="employee-photo-camera"
                  onClick={() => fileRef.current?.click()}
                  title="Change employee photo"
                >
                  📷
                </button>
              )}

            </div>

            {canManage && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={uploadPhoto}
                  style={{ display: "none" }}
                />

                <button
                  type="button"
                  className="employee-change-photo"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading
                    ? "Uploading..."
                    : "📷 Change Photo"}
                </button>

                <small>
                  JPG, PNG, WEBP · Max 2MB
                </small>
              </>
            )}

          </div>

          {/* MAIN INFORMATION */}
          <div className="employee-profile-main">

            <div className="employee-profile-name-row">
              <div>

                <h2>{employee.full_name}</h2>

                <p>
                  {employee.job_title || "Employee"}

                  {employee.department_name
                    ? ` · ${employee.department_name}`
                    : ""}
                </p>

                <div className="employee-profile-badges">

                  <span
                    className={`employee-profile-status status-${employee.status}`}
                  >
                    ● {statusText}
                  </span>

                  <span className="employee-profile-role">
                    💼 Employee
                  </span>

                  {employee.department_name && (
                    <span className="employee-profile-department">
                      🏢 {employee.department_name}
                    </span>
                  )}

                </div>

              </div>
            </div>

            <div className="employee-profile-divider" />

            {/* INFORMATION GRID */}
            <div className="employee-profile-info-grid">

              <ProfileInfo
                icon="👤"
                label="First name"
                value={employee.first_name}
              />

              <ProfileInfo
                icon="👤"
                label="Last name"
                value={employee.last_name}
              />

              <ProfileInfo
                icon="✉️"
                label="Email"
                value={employee.email}
              />

              <ProfileInfo
                icon="📞"
                label="Phone"
                value={employee.phone}
              />

              <ProfileInfo
                icon="💼"
                label="Job title"
                value={employee.job_title}
              />

              <ProfileInfo
                icon="🏢"
                label="Department"
                value={employee.department_name}
              />

              <ProfileInfo
                icon="📅"
                label="Date hired"
                value={employee.date_hired}
              />

              <ProfileInfo
                icon="🌴"
                label="Leave balance"
                value={`${employee.leave_balance ?? 0} days`}
              />

              <ProfileInfo
                icon="✅"
                label="Status"
                value={statusText}
              />

            </div>

          </div>

        </div>
      </div>

      {/* BOTTOM CARDS */}
      <div className="employee-profile-bottom">

        {/* EMERGENCY CONTACT */}
        <div className="employee-profile-small-card">
          <h3>🚨 Emergency Contact</h3>

          <div className="employee-emergency-list">
            <div className="employee-emergency-row">
              <span>Name</span>
              <strong>
                {employee.emergency_contact_name || "Not provided"}
              </strong>
            </div>

            <div className="employee-emergency-row">
              <span>Relationship</span>
              <strong>
                {employee.emergency_contact_relationship || "Not provided"}
              </strong>
            </div>

            <div className="employee-emergency-row">
              <span>Phone</span>
              <strong>
                {employee.emergency_contact_phone || "Not provided"}
              </strong>
            </div>
          </div>
        </div>

        {/* DEPARTMENT */}
        <div className="employee-profile-small-card">
          <h3>🏢 Department</h3>

          <div className="employee-department-big">
            {employee.department_name || "No Department"}
          </div>

          <p>
            {employee.job_title || "Employee"}
          </p>
        </div>

      </div>

    </div>
  );
}


function ProfileInfo({ icon, label, value }) {
  return (
    <div className="employee-profile-info-item">

      <div className="employee-profile-info-icon">
        {icon}
      </div>

      <div>

        <div className="employee-profile-info-label">
          {label}
        </div>

        <div className="employee-profile-info-value">
          {value || value === 0 ? value : "—"}
        </div>

      </div>

    </div>
  );
}