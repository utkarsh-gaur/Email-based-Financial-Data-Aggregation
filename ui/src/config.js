// In development (Vite), point to the local backend.
// In production (served by Node), use the same origin (relative paths).
export const API_BASE_URL = import.meta.env.DEV ? "http://localhost:8000" : "";
