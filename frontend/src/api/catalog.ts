import { api } from "./client";
import type { Category, Product, ProductInput } from "../types/catalog";

// ---- Kategori ----
export const listCategories = () => api.get<Category[]>("/api/v1/categories");
export const createCategory = (name: string) => api.post<Category>("/api/v1/categories", { name });
export const updateCategory = (id: string, name: string) =>
  api.put<Category>(`/api/v1/categories/${id}`, { name });
export const deleteCategory = (id: string) => api.del<void>(`/api/v1/categories/${id}`);

// ---- Produk ----
export const listProducts = (search = "") =>
  api.get<Product[]>(`/api/v1/products${search ? `?search=${encodeURIComponent(search)}` : ""}`);
export const getProduct = (id: string) => api.get<Product>(`/api/v1/products/${id}`);
export const createProduct = (input: ProductInput) => api.post<Product>("/api/v1/products", input);
export const updateProduct = (id: string, input: ProductInput) =>
  api.put<Product>(`/api/v1/products/${id}`, input);
export const deleteProduct = (id: string) => api.del<void>(`/api/v1/products/${id}`);
