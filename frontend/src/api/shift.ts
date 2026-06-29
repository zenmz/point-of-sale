import { api } from "./client";
import type { Shift } from "../types/shift";

// getCurrent: 204 (tak ada shift) dipetakan ke null oleh client → kembalikan null.
export const getCurrentShift = async (): Promise<Shift | null> =>
  (await api.get<Shift | null>("/api/v1/shifts/current")) ?? null;

export const openShift = (opening_cash: number, note?: string) =>
  api.post<Shift>("/api/v1/shifts/open", { opening_cash, note });

export const closeShift = (closing_cash: number, note?: string) =>
  api.post<Shift>("/api/v1/shifts/close", { closing_cash, note });
