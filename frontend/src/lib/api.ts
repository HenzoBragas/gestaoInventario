import axios from "axios";

const DEFAULT_API_URL = "/api/products";
const CATEGORIES_API_URL = "/api/categories";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? DEFAULT_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const categoriesApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? 
    import.meta.env.VITE_API_URL.replace(/\/products$/, "") + "/categories" :
    CATEGORIES_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});
