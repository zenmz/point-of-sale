import { api } from "./client";
import type { AnalyticsDashboard } from "../types/analytics";

export const getDashboard = (days = 14) =>
  api.get<AnalyticsDashboard>(`/api/v1/analytics/dashboard?days=${days}`);
