import axios from "axios";

// =========================
// API URL
// =========================
const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000/api";

// =========================
// AXIOS CLIENT
// =========================
export const client = axios.create({
  baseURL: API_URL,
});

// =========================
// GET TOKENS
// =========================
function getTokens() {
  return {
    access: localStorage.getItem("ems_access"),
    refresh: localStorage.getItem("ems_refresh"),
  };
}

// =========================
// SAVE TOKENS
// =========================
export function setTokens({ access, refresh }) {
  if (access) {
    localStorage.setItem("ems_access", access);
  }

  if (refresh) {
    localStorage.setItem("ems_refresh", refresh);
  }
}

// =========================
// CLEAR TOKENS
// =========================
export function clearTokens() {
  localStorage.removeItem("ems_access");
  localStorage.removeItem("ems_refresh");
}

// =========================
// REQUEST INTERCEPTOR
// Add JWT token automatically
// =========================
client.interceptors.request.use(
  (config) => {
    const { access } = getTokens();

    if (access) {
      config.headers.Authorization = `Bearer ${access}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// =========================
// TOKEN REFRESH SYSTEM
// =========================
let isRefreshing = false;
let queue = [];

function flushQueue(error, token = null) {
  queue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  queue = [];
}

// =========================
// RESPONSE INTERCEPTOR
// =========================
client.interceptors.response.use(
  (response) => response,

  async (error) => {
    const original = error.config;
    const { refresh } = getTokens();

    // If there is no request config,
    // return the original error.
    if (!original) {
      return Promise.reject(error);
    }

    // Access token expired
    if (
      error.response &&
      error.response.status === 401 &&
      !original._retry &&
      refresh &&
      !original.url?.includes("/auth/")
    ) {
      // Another refresh request is already running
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({
            resolve,
            reject,
          });
        }).then((token) => {
          original.headers =
            original.headers || {};

          original.headers.Authorization =
            `Bearer ${token}`;

          return client(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        // Request new access token
        const { data } = await axios.post(
          `${API_URL}/auth/refresh/`,
          {
            refresh,
          }
        );

        // Save new access token
        setTokens({
          access: data.access,
        });

        // Continue waiting requests
        flushQueue(null, data.access);

        original.headers =
          original.headers || {};

        original.headers.Authorization =
          `Bearer ${data.access}`;

        // Retry original request
        return client(original);
      } catch (refreshError) {
        // Refresh token also expired/invalid
        flushQueue(refreshError, null);

        clearTokens();

        window.location.href = "/login";

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);