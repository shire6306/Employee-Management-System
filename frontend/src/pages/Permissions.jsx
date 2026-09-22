import { useEffect, useMemo, useState } from "react";
import { client } from "../api/client.js";

export default function Permissions() {
  const [users, setUsers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [state, setState] = useState(null);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    setLoading(true);
    setError("");
    try {
      const [usersResponse, catalogResponse] = await Promise.all([
        client.get("/users/"),
        client.get("/users/permissions-catalog/"),
      ]);

      const userList = usersResponse.data?.results ?? usersResponse.data ?? [];
      const permissionList =
        catalogResponse.data?.results ?? catalogResponse.data ?? [];

      setUsers(userList);
      setCatalog(permissionList);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not load permission management data."
      );
    } finally {
      setLoading(false);
    }
  }

  async function selectUser(userId) {
    setSelectedId(userId);
    setState(null);
    setValues({});
    setMessage("");
    setError("");

    if (!userId) return;

    setPermissionLoading(true);
    try {
      const { data } = await client.get(`/users/${userId}/permissions/`);
      setState(data);

      const effective = new Set(data.effective_permissions ?? []);
      const nextValues = {};

      catalog.forEach((permission) => {
        nextValues[permission.code] = effective.has(permission.code);
      });

      setValues(nextValues);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Could not load this user's permissions."
      );
    } finally {
      setPermissionLoading(false);
    }
  }

  function togglePermission(code) {
    setValues((current) => ({
      ...current,
      [code]: !current[code],
    }));
  }

  async function savePermissions() {
    if (!selectedId) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const permissions = catalog.map((permission) => ({
        code: permission.code,
        allowed: Boolean(values[permission.code]),
      }));

      const { data } = await client.patch(
        `/users/${selectedId}/permissions/`,
        { permissions }
      );

      const effective = new Set(data.effective_permissions ?? []);
      const nextValues = {};
      catalog.forEach((permission) => {
        nextValues[permission.code] = effective.has(permission.code);
      });

      setValues(nextValues);
      setState((current) => ({
        ...(current || {}),
        effective_permissions: data.effective_permissions ?? [],
      }));
      setMessage("Permissions saved successfully.");
    } catch (err) {
      const data = err.response?.data;
      setError(
        data?.detail ||
          (typeof data === "object"
            ? Object.values(data).flat().join(" ")
            : "Could not save permissions.")
      );
    } finally {
      setSaving(false);
    }
  }

  async function resetPermissions() {
    if (!selectedId) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { data } = await client.post(
        `/users/${selectedId}/reset-permissions/`
      );

      const effective = new Set(data.effective_permissions ?? []);
      const nextValues = {};

      catalog.forEach((permission) => {
        nextValues[permission.code] = effective.has(permission.code);
      });

      setValues(nextValues);
      setState((current) => ({
        ...(current || {}),
        effective_permissions: data.effective_permissions ?? [],
        overrides: [],
      }));
      setMessage("Permissions reset to role defaults.");
    } catch (err) {
      setError(
        err.response?.data?.detail || "Could not reset permissions."
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedUser = users.find(
    (item) => String(item.id) === String(selectedId)
  );

  const grouped = useMemo(() => {
    return catalog.reduce((groups, permission) => {
      const moduleName = permission.module || "other";
      if (!groups[moduleName]) groups[moduleName] = [];
      groups[moduleName].push(permission);
      return groups;
    }, {});
  }, [catalog]);

  const defaults = new Set(state?.default_permissions ?? []);

  if (loading) {
    return <div className="card" style={{ padding: 24 }}>Loading permissions...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>
          Permission Management
        </h1>
        <p style={{ color: "var(--ink-soft)", margin: 0 }}>
          Grant or revoke system permissions for individual users.
        </p>
      </div>

      {error && (
        <div
          className="card"
          style={{ padding: 14, color: "var(--rust, #b91c1c)" }}
        >
          {error}
        </div>
      )}

      {message && (
        <div
          className="card"
          style={{ padding: 14, color: "var(--success, #15803d)" }}
        >
          {message}
        </div>
      )}

      <div className="card" style={{ padding: 18 }}>
        <div className="field" style={{ maxWidth: 520 }}>
          <label>Select User</label>
          <select
            value={selectedId}
            onChange={(e) => selectUser(e.target.value)}
          >
            <option value="">Choose a user...</option>
            {users.map((item) => (
              <option key={item.id} value={item.id}>
                {item.first_name || item.last_name
                  ? `${item.first_name ?? ""} ${item.last_name ?? ""}`.trim()
                  : item.username}
                {" — "}
                {(item.role || "user").replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        {selectedUser && (
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid var(--line)",
            }}
          >
            <strong>
              {selectedUser.first_name} {selectedUser.last_name}
            </strong>
            <div
              style={{
                marginTop: 4,
                color: "var(--ink-soft)",
                fontSize: 13,
              }}
            >
              Username: {selectedUser.username}
              {" · "}Role: {(state?.role || selectedUser.role || "—").replaceAll("_", " ")}
              {" · "}Department: {selectedUser.department_name || "—"}
            </div>
          </div>
        )}
      </div>

      {selectedId && (
        permissionLoading ? (
          <div className="card" style={{ padding: 24 }}>
            Loading user permissions...
          </div>
        ) : (
          <>
            {Object.entries(grouped).map(([moduleName, permissions]) => (
              <div className="card" key={moduleName} style={{ overflow: "hidden" }}>
                <div
                  style={{
                    padding: "14px 18px",
                    fontWeight: 800,
                    fontSize: 16,
                    textTransform: "capitalize",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  {moduleName.replaceAll("_", " ")}
                </div>

                <div>
                  {permissions.map((permission) => {
                    const roleDefault = defaults.has(permission.code);
                    const enabled = Boolean(values[permission.code]);

                    return (
                      <div
                        key={permission.code}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 16,
                          padding: "14px 18px",
                          borderBottom: "1px solid var(--line)",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 650 }}>
                            {permission.name}
                          </div>
                          <div
                            style={{
                              color: "var(--ink-soft)",
                              fontSize: 12,
                              marginTop: 3,
                            }}
                          >
                            {permission.code}
                            {" · "}
                            Role default: {roleDefault ? "Allowed" : "Denied"}
                          </div>
                        </div>

                        <button
                          type="button"
                          aria-pressed={enabled}
                          onClick={() => togglePermission(permission.code)}
                          style={{
                            width: 54,
                            height: 30,
                            borderRadius: 999,
                            border: enabled
                              ? "1px solid #2563eb"
                              : "1px solid #cbd5e1",
                            background: enabled ? "#2563eb" : "#e2e8f0",
                            padding: 3,
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: enabled ? "flex-end" : "flex-start",
                            alignItems: "center",
                            flexShrink: 0,
                          }}
                          title={enabled ? "Allowed" : "Denied"}
                        >
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: "50%",
                              background: "#fff",
                              display: "block",
                              boxShadow: "0 1px 4px rgba(0,0,0,.2)",
                            }}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div
              className="card"
              style={{
                padding: 16,
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                disabled={saving}
                onClick={resetPermissions}
              >
                Reset to role defaults
              </button>

              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={savePermissions}
              >
                {saving ? "Saving..." : "Save permissions"}
              </button>
            </div>
          </>
        )
      )}
    </div>
  );
}
