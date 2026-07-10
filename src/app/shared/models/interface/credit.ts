export interface Credit {
  id: string;
  type: string;
  product: string;
  originalAmount: number;
  pendingBalance: number;
  currentInstallment: number;
  totalInstallments: number;
  /** Valor de la cuota (todas son uniformes). 0 si el plan aún no existe. */
  installmentAmount: number;
  /** Etiqueta según la frecuencia real: "Cuota Diaria/Semanal/Quincenal/Mensual". */
  installmentLabel: string;
  nextDueDate: string;
  rate: string;
  status: 'ACTIVE' | 'OVERDUE' | 'PAID';
  progress: number;
  overdueDays?: number;
  accruedLateFee?: number;
  lateFeeExpiry?: string;
}
