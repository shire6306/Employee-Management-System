import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  // =========================
  // AUTH
  // =========================
  const { user, login } = useAuth();

  // Waxaa loo isticmaalaa page kale loogu wareego
  const navigate = useNavigate();

  // =========================
  // FORM STATE
  // =========================
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Error message
  const [error, setError] = useState("");

  // Waxaa lagu ogaadaa marka login-ku socdo
  const [submitting, setSubmitting] = useState(false);

  // =========================
  // HADDII USER HORE U LOGIN YAHAY
  // =========================
  // Login page ha tusin,
  // dashboard-ka u dir.
  if (user) {
    return <Navigate to="/" replace />;
  }

  // =========================
  // LOGIN FUNCTION
  // =========================
  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      // Username iyo password backend-ka u dir
      await login(username, password);

      // Haddii login-ku sax yahay,
      // dashboard-ka u gudub
      navigate("/");
    } catch (err) {
      // Haddii username/password khaldan yihiin
      setError("Invalid username or password.");
    } finally {
      // Login process waa dhammaaday
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1.05fr 0.95fr",
        background: "#f8faff",
      }}
    >
      {/* =====================================
          LEFT SIDE
          Blue introduction section
      ====================================== */}
      <section
        style={{
          padding: "56px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(145deg, #3478f6, #5b5ff0)",
          color: "white",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Logo */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
          }}
        >
          EMS{" "}
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              opacity: 0.8,
            }}
          >
            Employee Management System
          </span>
        </div>

        {/* Main text */}
        <div
          style={{
            maxWidth: 560,
            position: "relative",
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontSize: 13,
              opacity: 0.8,
              marginBottom: 14,
            }}
          >
            SMART WORKFORCE MANAGEMENT
          </div>

          <h1
            style={{
              fontSize: "clamp(2.4rem, 5vw, 4.6rem)",
              lineHeight: 1.04,
              letterSpacing: "-.055em",
            }}
          >
            Everything your team needs, in one place.
          </h1>

          <p
            style={{
              marginTop: 20,
              lineHeight: 1.8,
              opacity: 0.8,
              maxWidth: 480,
            }}
          >
            Manage employees, departments, leave requests, tasks and attendance
                 through one clean and secure workspace.
          </p>
        </div>

        {/* Bottom text */}
        <div
          style={{
            fontSize: 12,
            opacity: 0.65,
          }}
        >
          Secure management portal
        </div>

        {/* Background decorative circle */}
        <div
          style={{
            position: "absolute",
            width: 420,
            height: 420,
            borderRadius: "50%",
            right: -170,
            top: -120,
            background: "rgba(255,255,255,.10)",
          }}
        />
      </section>

      {/* =====================================
          RIGHT SIDE
          Login form
      ====================================== */}
      <section
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <div
          style={{
            width: 400,
            maxWidth: "100%",
          }}
        >
          {/* Login header */}
          <div
            style={{
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                background: "#edf4ff",
                color: "#3478f6",
                fontWeight: 900,
                marginBottom: 18,
              }}
            >
              EMS
            </div>

            <h1
              style={{
                fontSize: 28,
              }}
            >
              Welcome back
            </h1>

            <p
              style={{
                color: "var(--ink-soft)",
                marginTop: 8,
                fontSize: 14,
              }}
            >
              Sign in to access your management dashboard.
            </p>
          </div>

          {/* =====================================
              LOGIN FORM
          ====================================== */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* Username */}
            <div className="field">
              <label htmlFor="username">
                Username
              </label>

              <input
                id="username"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value)
                }
                autoFocus
                required
                placeholder="Enter your username"
                style={{
                  minHeight: 46,
                }}
              />
            </div>

            {/* Password */}
            <div className="field">
              <label htmlFor="password">
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
                placeholder="••••••••"
                style={{
                  minHeight: 46,
                }}
              />
            </div>

            {/* Error message */}
            {error && (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--rust)",
                  background: "var(--rust-tint)",
                  padding: "10px 12px",
                  borderRadius: 8,
                }}
              >
                {error}
              </div>
            )}

            {/* Login button */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{
                minHeight: 46,
                marginTop: 4,
              }}
            >
              {submitting
                ? "Signing in…"
                : "Sign in"}
            </button>
          </form>

          {/* Bottom note */}
          <p
            style={{
              fontSize: 11,
              color: "#98a2b3",
              marginTop: 22,
              textAlign: "center",
            }}
          >
            Authorized employees and managers only.
          </p>
        </div>
      </section>
    </div>
  );
}