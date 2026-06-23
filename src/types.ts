export interface Vehicle {
  id: string;
  brandModel: string;
  plate: string;
  weeklyRate: number;
  depositValue: number;
  status: 'available' | 'rented' | 'maintenance';
  isDeleted?: boolean;
  mileage?: number;
  mileageDate?: string;
  estimatedValue?: number;
  estimatedValueDate?: string;
}

export interface Rental {
  id: string;
  vehicleId: string;
  tenantName: string;
  phone?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  weeklyRate: number;
  depositValue: number;
  status: 'active' | 'completed';
  isDeleted?: boolean;
  semanaAdiantada?: boolean;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'receita' | 'despesa' | 'caucao_recebido' | 'caucao_devolvido';
  value: number;
  vehicleId?: string; // Optional links to vehicle
  category: string;
  description: string; // facultativa (optional)
  status?: 'pending' | 'realized'; // to support manually created future transactions already paid/abatido
}

export interface FutureExpenseInstallment {
  id: string;
  installmentNumber: number;
  dueDate: string; // YYYY-MM-DD
  status: 'pending' | 'realized';
  realizedTransactionId?: string;
}

export interface FutureExpense {
  id: string;
  description: string;
  category: string;
  value: number; // value per installment
  installmentsCount: number;
  startDate: string;
  dueDay: number; // 1-31
  vehicleId?: string;
  installments: FutureExpenseInstallment[];
}

export interface CashFlowPoint {
  date: string;
  receitas: number;
  despesas: number;
  caucao: number;
  saldo: number;
  acumulado: number;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'user' | 'socio';
}

export interface AccessLog {
  id: string;
  userName: string;
  userEmail: string;
  userRole: string;
  timestamp: string; // ISO string standard BRL-timezone format
  deviceInfo: string; // Browser/useragent snippet
}
