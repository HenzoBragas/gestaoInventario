import axios from "axios";

const DEFAULT_API_URL = "/api/products";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? DEFAULT_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});
