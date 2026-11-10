export type TransactionType = 'due' | 'payment';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: Date | null;
  updatedAt?: Date | null;
}

export interface Customer {
  id: string;
  userId: string;
  name: string;
  phone: string;
  totalDue: number;
  totalPayment: number;
  createdAt: Date | null;
  updatedAt?: Date | null;
}

export interface LedgerTransaction {
  id: string;
  userId: string;
  customerId: string;
  type: TransactionType;
  amount: number;
  note: string;
  transactionDate: Date;
  createdAt: Date | null;
  updatedAt?: Date | null;
}

export type BalanceStatus = 'due' | 'advance' | 'settled';

export interface BalanceSummary {
  net: number; // totalDue - totalPayment
  status: BalanceStatus;
  absAmount: number;
}
