import type { CSSProperties } from "react";

export const wrap: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#f4f5f7",
};
export const card: CSSProperties = {
  background: "#fff",
  padding: "2rem",
  borderRadius: 12,
  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
  width: 340,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
export const label: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 14,
};
export const input: CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #ccc",
  borderRadius: 8,
  fontSize: 15,
};
export const button: CSSProperties = {
  padding: "11px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 15,
  cursor: "pointer",
};
export const errBox: CSSProperties = {
  background: "#fee2e2",
  color: "#b91c1c",
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 14,
  margin: 0,
};
