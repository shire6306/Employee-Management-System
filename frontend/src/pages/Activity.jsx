import { Fragment, useEffect, useState } from "react";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";


// ==============================
// AUDIT ACTION LABELS
// ==============================
// Backend-ka wuxuu soo diraa values sida:
// create, update, delete, approve, reject
// Halkan waxaan uga dhigaynaa magacyo qurux badan.
const ACTION_LABEL = {
  create: "Create",
  update: "Update",
  delete: "Delete",
  approve: "Approve",
  reject: "Reject",
};


// ==============================
// MAIN LOGS PAGE
// ==============================
export default function Activity() {
  // User-ka hadda login-ka ah
  const { user } = useAuth();

  // Tab-ka hadda la furay
  const [tab, setTab] = useState("activity");

  // Admin wuxuu arki karaa:
  // Activity Log
  // Audit Log
  // Error Log
  //
  // General Manager wuxuu arki karaa:
  // Activity Log
  // Audit Log
  const tabs = [
    "activity",
    "audit",
    ...(user?.role === "admin" ? ["errors"] : []),
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.2rem",
      }}
    >
      {/* =========================
          PAGE HEADER
      ========================== */}
      <div>
        <h1
          style={{
            fontSize: "1.5rem",
          }}
        >
          Logs
        </h1>

        <p
          style={{
            color: "var(--ink-soft)",
            marginTop: 4,
          }}
        >
          Activity and audit are visible to Admin/General Manager.
          Error Log is Admin only.
        </p>
      </div>


      {/* =========================
          LOG TABS
      ========================== */}
      <div
        style={{
          display: "flex",
          gap: 6,
        }}
      >
        {tabs.map((tabName) => (
          <button
            key={tabName}
            className={
              tab === tabName
                ? "btn btn-primary btn-sm"
                : "btn btn-ghost btn-sm"
            }
            onClick={() => setTab(tabName)}
          >
            {tabName === "activity"
              ? "Activity Log"
              : tabName === "audit"
              ? "Audit Log"
              : "Error Log"}
          </button>
        ))}
      </div>


      {/* =========================
          SHOW SELECTED TABLE
      ========================== */}
      {tab === "activity" ? (
        <ActivityTable />
      ) : tab === "audit" ? (
        <AuditTable />
      ) : (
        <ErrorTable />
      )}
    </div>
  );
}


// =====================================================
// ACTIVITY LOG TABLE
// =====================================================
function ActivityTable() {
  // Activity records-ka
  const [rows, setRows] = useState([]);

  // Marka component-ku furmo,
  // backend-ka ka soo qaado activity logs.
  useEffect(() => {
    client
      .get("/activity-logs/")
      .then(({ data }) => {
        // Haddii API pagination leeyahay -> data.results
        // Haddii uusan lahayn -> data
        setRows(data.results ?? data);
      });
  }, []);

  return (
    <Table
      heads={[
        "When",
        "Who",
        "Activity",
        "Details",
      ]}
    >
      {rows.map((row) => (
        <tr key={row.id}>
          {/* Date / Time */}
          <td>
            {new Date(row.created_at).toLocaleString()}
          </td>

          {/* User */}
          <td>
            {row.actor?.username || "System"}
          </td>

          {/* Activity */}
          <td>
            {row.activity}
          </td>

          {/* Details */}
          <td>
            {row.details}
          </td>
        </tr>
      ))}
    </Table>
  );
}


// =====================================================
// AUDIT LOG TABLE
// =====================================================
function AuditTable() {
  // Audit records-ka
  const [rows, setRows] = useState([]);

  // Backend-ka ka soo qaado audit logs.
  useEffect(() => {
    client
      .get("/audit-logs/")
      .then(({ data }) => {
        setRows(data.results ?? data);
      });
  }, []);

  return (
    <Table
      heads={[
        "When",
        "Who",
        "Action",
        "Record",
      ]}
    >
      {rows.map((row) => (
        <tr key={row.id}>
          {/* Date / Time */}
          <td>
            {new Date(row.created_at).toLocaleString()}
          </td>

          {/* User */}
          <td>
            {row.actor?.username || "System"}
          </td>

          {/* Action */}
          <td>
            <span className="badge badge-update">
              {ACTION_LABEL[row.action] || row.action}
            </span>
          </td>

          {/* Record */}
          <td>
            {row.model_name} — {row.object_repr}
          </td>
        </tr>
      ))}
    </Table>
  );
}


// =====================================================
// ERROR LOG TABLE
// =====================================================
function ErrorTable() {
  // Error records-ka
  const [rows, setRows] = useState([]);

  // ID-ga error-ka hadda la expand gareeyey
  const [expanded, setExpanded] = useState(null);

  // Backend-ka ka soo qaado error logs.
  useEffect(() => {
    client
      .get("/error-logs/")
      .then(({ data }) => {
        setRows(data.results ?? data);
      });
  }, []);

  return (
    <Table
      heads={[
        "When",
        "Level",
        "Request",
        "Message",
      ]}
    >
      {rows.map((row) => (
        <Fragment key={row.id}>
          {/* Main error row */}
          <tr
            onClick={() =>
              setExpanded(
                expanded === row.id
                  ? null
                  : row.id
              )
            }
            style={{
              cursor: "pointer",
            }}
          >
            {/* Date / Time */}
            <td>
              {new Date(row.created_at).toLocaleString()}
            </td>

            {/* Error Level */}
            <td>
              {row.level}
            </td>

            {/* Request */}
            <td>
              {row.method} {row.path}
            </td>

            {/* Error Message */}
            <td>
              {row.message}
            </td>
          </tr>


          {/* =========================
              TRACEBACK DETAILS
          ========================== */}
          {expanded === row.id && row.traceback && (
            <tr>
              <td colSpan={4}>
                <pre
                  style={{
                    overflow: "auto",
                    maxHeight: 260,
                  }}
                >
                  {row.traceback}
                </pre>
              </td>
            </tr>
          )}
        </Fragment>
      ))}
    </Table>
  );
}


// =====================================================
// REUSABLE TABLE COMPONENT
// =====================================================
function Table({ heads, children }) {
  return (
    <div className="card">
      <table className="table">
        {/* Table Header */}
        <thead>
          <tr>
            {heads.map((head) => (
              <th key={head}>
                {head}
              </th>
            ))}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {children}
        </tbody>
      </table>
    </div>
  );
}