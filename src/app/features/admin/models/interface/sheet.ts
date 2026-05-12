export interface PlanillaEntry {
  clientName: string;
  clientDni: string;
  clientPhone: string | null;
  clientAddress: string | null;
  creditId: string;
  creditType: string;
  installmentNumber: number;
  amount: number;
  paidAmount: number;
  dueDate: string;
  paymentStatus: string;
}

export interface GeneratedPlanillaResult {
  collectorId: string;
  collectorName: string;
  fecha: string;
  clientCount: number;
  totalAmount: number;
  sheetId: string;
  entries: PlanillaEntry[];
}
