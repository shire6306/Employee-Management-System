import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  client,
  setTokens,
  clearTokens,
} from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // =========================
  // USER STATE
  // =========================
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // =========================
  // LOAD CURRENT USER
  // =========================
  async function loadUser() {
    const token = localStorage.getItem("ems_access");

    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const { data } = await client.get("/me/");

      setUser(data);

      return data;
    } catch (error) {
      console.error("Could not load user.", error);

      clearTokens();
      setUser(null);

      return null;
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // LOAD USER WHEN APP STARTS
  // =========================
  useEffect(() => {
    loadUser();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================
  // LOGIN
  // =========================
  async function login(username, password) {
    const { data } = await client.post(
      "/auth/login/",
      {
        username,
        password,
      }
    );

    setTokens({
      access: data.access,
      refresh: data.refresh,
    });

    return await loadUser();
  }

  // =========================
  // LOGOUT
  // =========================
  async function logout() {
    try {
      await client.post("/auth/logout/");
    } catch (error) {
      console.error(
        "Could not record logout activity.",
        error
      );
    } finally {
      clearTokens();
      setUser(null);
    }
  }

  // =========================
  // REFRESH CURRENT USER
  // =========================
  async function refreshUser() {
    return await loadUser();
  }

  // =========================
  // PERMISSIONS
  // =========================
  function hasPermission(permissionCode) {
    if (!user) {
      return false;
    }

    // Admin always has full access
    if (
      user.role === "admin" ||
      user.is_superuser === true
    ) {
      return true;
    }

    const permissions = Array.isArray(user.permissions)
      ? user.permissions
      : [];

    return permissions.includes(permissionCode);
  }

  // =========================
  // HAS ANY PERMISSION
  // =========================
  function hasAnyPermission(permissionCodes = []) {
    if (!user) {
      return false;
    }

    if (
      user.role === "admin" ||
      user.is_superuser === true
    ) {
      return true;
    }

    return permissionCodes.some((permissionCode) =>
      hasPermission(permissionCode)
    );
  }

  // =========================
  // HAS ALL PERMISSIONS
  // =========================
  function hasAllPermissions(permissionCodes = []) {
    if (!user) {
      return false;
    }

    if (
      user.role === "admin" ||
      user.is_superuser === true
    ) {
      return true;
    }

    return permissionCodes.every((permissionCode) =>
      hasPermission(permissionCode)
    );
  }

  // =========================
  // ROLE HELPERS
  // =========================
  function hasRole(...roles) {
    if (!user) {
      return false;
    }

    return roles.includes(user.role);
  }

  const isAdmin =
    user?.role === "admin" ||
    user?.is_superuser === true;

  // =========================
  // AUTH CONTEXT
  // =========================
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,

        login,
        logout,

        refreshUser,

        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        hasRole,

        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// =========================
// USE AUTH HOOK
// =========================
export function useAuth() {
  return useContext(AuthContext);
}