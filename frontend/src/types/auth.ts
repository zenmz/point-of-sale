export type Role = "admin" | "kasir" | "owner";

export interface User {
  id: string;
  store_id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
