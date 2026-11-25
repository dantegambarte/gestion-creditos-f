import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { CashRegisterService } from './cash-register.service';

/** Estado de caja resuelto para validar acciones que mueven dinero. */
export type CashStatus = 'OPEN' | 'CLOSED' | 'UNKNOWN';

/** Mensaje de toast listo para `MessageService.add`. */
export interface CashStatusMessage {
  severity: 'error';
  summary: string;
  detail: string;
  life: number;
}

/**
 * Fuente única del estado de caja para el frontend (V4: caja operativa activa).
 * Falla cerrado: si la consulta falla, devuelve UNKNOWN y la acción se bloquea.
 * Es solo una ayuda de UX; el backend sigue siendo la defensa real.
 */
@Injectable({ providedIn: 'root' })
export class CashStatusService {
  private readonly cashRegisterSvc = inject(CashRegisterService);
  private readonly auth = inject(AuthServiceBase);

  /**
   * Resuelve si hay una caja operativa abierta en la jornada actual.
   * Para usuarios no ADMIN (que no pueden consultar cajas) no se valida en
   * cliente y se delega la regla al backend, igual que hasta ahora.
   * @returns OPEN, CLOSED o UNKNOWN (error de consulta).
   */
  resolve(): Observable<CashStatus> {
    if (!this.auth.hasRole('ADMIN')) return of<CashStatus>('OPEN');
    return this.cashRegisterSvc.getActiveSession().pipe(
      map((session): CashStatus => (session ? 'OPEN' : 'CLOSED')),
      catchError((err: unknown) => {
        console.warn(
          '[CashStatusService] No se pudo consultar la caja activa; se bloquea (UNKNOWN).',
          err,
        );
        return of<CashStatus>('UNKNOWN');
      }),
    );
  }

  /**
   * Valida en vivo si una acción que mueve caja puede ejecutarse.
   * @param action - acción en infinitivo para el mensaje de estado desconocido.
   * @param closedDetail - detalle a mostrar cuando la caja está cerrada.
   * @returns null si puede continuar, o el mensaje de bloqueo a mostrar.
   */
  checkAction(action: string, closedDetail: string): Observable<CashStatusMessage | null> {
    return this.resolve().pipe(
      map((status) => {
        if (status === 'OPEN') return null;
        if (status === 'UNKNOWN') return this.unknownMessage(action);
        return {
          severity: 'error' as const,
          summary: 'Caja Cerrada',
          detail: closedDetail,
          life: 5000,
        };
      }),
    );
  }

  /**
   * Arma el mensaje de bloqueo cuando no se pudo verificar el estado de caja.
   * @param action - acción bloqueada en infinitivo (ej. "aprobar cobros").
   */
  unknownMessage(action: string): CashStatusMessage {
    return {
      severity: 'error',
      summary: 'Estado de caja desconocido',
      detail: `No se pudo verificar el estado de la caja. No puedes ${action} hasta confirmarlo. Reintentá en unos segundos.`,
      life: 6000,
    };
  }
}
