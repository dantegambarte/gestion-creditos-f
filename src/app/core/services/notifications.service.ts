import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { interval, Subscription } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { ApiHttpService } from '../http/api-http.service';

export type NotificationType =
  | 'MORA'
  | 'INSTALLMENT_DUE'
  | 'APPROVAL_REQUEST'
  | 'CASH_REGISTER'
  | 'NEW_CUSTOMER'
  | 'WEEKLY_REPORT';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read_at: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

export interface NotificationHistoryPage {
  items: NotificationItem[];
  total: number;
  page: number;
  limit: number;
}

export interface NotificationPreference {
  type: NotificationType;
  enabled: boolean;
  email_enabled: boolean;
  frequency: 'INSTANT' | 'DAILY' | 'WEEKLY';
  updated_at: string;
}

const POLLING_INTERVAL_MS = 45_000;

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(ApiHttpService);
  private pollingSub: Subscription | null = null;

  /** Cantidad de notificaciones no leídas del usuario autenticado. */
  readonly unreadCount = signal(0);

  /**
   * Inicia el polling de unread-count cada 45s. Se pausa automáticamente
   * cuando la pestaña está oculta (`document.hidden`) para no gastar
   * llamadas de red innecesarias en segundo plano.
   */
  startPolling(): void {
    if (this.pollingSub) return; // ya está corriendo — evita duplicar el intervalo.

    this.pollingSub = interval(POLLING_INTERVAL_MS)
      .pipe(
        switchMap(() => {
          if (typeof document !== 'undefined' && document.hidden) {
            return [] as unknown as Observable<{ count: number }>;
          }
          return this.api.get<{ count: number }>('notifications/unread-count');
        }),
        tap((res) => {
          if (res) this.unreadCount.set(res.count);
        }),
      )
      .subscribe();

    // Primer fetch inmediato — no esperar los 45s iniciales.
    this.refreshUnreadCount();
  }

  /** Detiene el polling activo (uso típico: logout / destrucción del shell). */
  stopPolling(): void {
    this.pollingSub?.unsubscribe();
    this.pollingSub = null;
  }

  /** Refresca el unread-count una sola vez, sin esperar al intervalo. */
  refreshUnreadCount(): void {
    this.api
      .get<{ count: number }>('notifications/unread-count')
      .subscribe((res) => this.unreadCount.set(res.count));
  }

  /**
   * Historial paginado de notificaciones del usuario autenticado.
   * @param page - 1-indexed.
   * @param limit - Tamaño de página (default backend: 20).
   */
  list(page = 1, limit = 20): Observable<NotificationHistoryPage> {
    return this.api.get<NotificationHistoryPage>('notifications', { page, limit });
  }

  /**
   * Marca una notificación como leída y refresca el unread-count local.
   * @param id - ID de la notificación.
   */
  markRead(id: string): Observable<void> {
    return this.api.post<void>(`notifications/${id}/read`).pipe(
      tap(() => this.refreshUnreadCount()),
    );
  }

  /** Marca todas las notificaciones del usuario como leídas. */
  markAllRead(): Observable<void> {
    return this.api.post<void>('notifications/read-all').pipe(
      tap(() => this.unreadCount.set(0)),
    );
  }

  /** Lee las 6 preferencias de notificación (config global, solo ADMIN). */
  getPreferences(): Observable<NotificationPreference[]> {
    return this.api.get<NotificationPreference[]>('notifications/preferences');
  }

  /**
   * Actualiza la preferencia de un tipo de notificación.
   * @param type - Tipo de notificación a actualizar.
   * @param data - Campos a modificar (parciales).
   */
  updatePreference(
    type: NotificationType,
    data: Partial<Pick<NotificationPreference, 'enabled' | 'email_enabled' | 'frequency'>>,
  ): Observable<NotificationPreference> {
    return this.api.put<NotificationPreference>(`notifications/preferences/${type}`, data);
  }
}
