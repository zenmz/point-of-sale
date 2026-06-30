export interface Customer {
  id: string;
  store_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  points: number;
  created_at: string;
}

export interface LoyaltyEntry {
  id: string;
  type: "earn" | "redeem" | "adjust";
  points: number;
  balance_after: number;
  note: string | null;
  created_at: string;
}

export interface Purchase {
  id: string;
  number: number;
  total: number;
  points_earned: number;
  created_at: string;
}

export interface CustomerDetail extends Customer {
  loyalty: LoyaltyEntry[];
  purchases: Purchase[];
}
