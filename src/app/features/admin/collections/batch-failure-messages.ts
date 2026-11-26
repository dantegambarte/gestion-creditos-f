import { Message } from 'primeng/api';

/** Fallo de generación de planilla para un cobrador. */
export interface BatchFailure {
  collectorName: string;
  error?: { status: number; message?: string } | null;
}

/** Status con el que el backend indica que el cobrador no tiene cuotas para la fecha/filtro. */
export const NO_INSTALLMENTS_STATUS = 409;

/**
 * Arma los toasts de fallos de generación masiva distinguiendo por status:
 * 409 es "sin cuotas" (aviso) y cualquier otro error (500, red) es un fallo real.
 * @param failures - Cobradores cuya planilla no se generó.
 * @returns Mensajes listos para `MessageService.add` (vacío si no hubo fallos).
 */
export function buildBatchFailureMessages(failures: BatchFailure[]): Message[] {
  const noInstallments = failures.filter((f) => f.error?.status === NO_INSTALLMENTS_STATUS);
  const realErrors = failures.filter((f) => f.error?.status !== NO_INSTALLMENTS_STATUS);
  const names = (list: BatchFailure[]): string => list.map((f) => f.collectorName).join(', ');
  const messages: Message[] = [];
  if (realErrors.length > 0) {
    messages.push({
      severity: 'error',
      summary: 'Error al generar planillas',
      detail: `No se pudo generar para: ${names(realErrors)}. Reintentá en unos minutos.`,
      life: 8000,
    });
  }
  if (noInstallments.length > 0) {
    messages.push({
      severity: 'warn',
      summary: 'Sin cuotas',
      detail: `Sin cuotas para: ${names(noInstallments)}`,
      life: 8000,
    });
  }
  return messages;
}
