import { Injectable, inject, signal } from '@angular/core';
import { interval, Observable, of, Subscription } from 'rxjs';
import { finalize, shareReplay, switchMap, tap } from 'rxjs/operators';
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

const POLLING_INTERVAL_MS = 90_000;
const HISTORY_CACHE_TTL_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(ApiHttpService);
  private pollingSub: Subscription | null = null;
  private historyCache: {
    key: string;
    expiresAt: number;
    page: NotificationHistoryPage;
  } | null = null;
  private historyRequest: Observable<NotificationHistoryPage> | null = null;
  private historyRequestKey: string | null = null;
  private preferencesCache: NotificationPreference[] | null = null;
  private preferencesRequest: Observable<NotificationPreference[]> | null =
    null;
  private visibilityHandler: (() => void) | null = null;

  /** Cantidad de notificaciones no leídas del usuario autenticado. */
  readonly unreadCount = signal(0);

  /**
   * Inicia el polling de unread-count cada 90s. Se pausa automáticamente
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
          if (res) this.setUnreadCount(res.count);
        }),
      )
      .subscribe();

    // Primer fetch inmediato — no esperar los 90s iniciales.
    this.refreshUnreadCount();

    if (typeof document !== 'undefined' && !this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (!document.hidden) this.refreshUnreadCount();
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  /** Detiene el polling activo (uso típico: logout / destrucción del shell). */
  stopPolling(): void {
    this.pollingSub?.unsubscribe();
    this.pollingSub = null;

    if (typeof document !== 'undefined' && this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  /** Refresca el unread-count una sola vez, sin esperar al intervalo. */
  refreshUnreadCount(): void {
    this.api
      .get<{ count: number }>('notifications/unread-count')
      .subscribe((res) => this.setUnreadCount(res.count));
  }

  /**
   * Historial paginado de notificaciones del usuario autenticado.
   * @param page - 1-indexed.
   * @param limit - Tamaño de página (default backend: 20).
   * @param forceRefresh - Ignora el cache local cuando se necesita dato fresco.
   */
  list(
    page = 1,
    limit = 20,
    forceRefresh = false,
  ): Observable<NotificationHistoryPage> {
    const key = `${page}:${limit}`;
    const now = Date.now();
    if (
      !forceRefresh &&
      this.historyCache?.key === key &&
      this.historyCache.expiresAt > now
    ) {
      return of(this.historyCache.page);
    }
    if (
      !forceRefresh &&
      this.historyRequest &&
      this.historyRequestKey === key
    ) {
      return this.historyRequest;
    }

    this.historyRequestKey = key;
    this.historyRequest = this.api
      .get<NotificationHistoryPage>('notifications', { page, limit })
      .pipe(
        tap((pageResult) => {
          this.historyCache = {
            key,
            expiresAt: Date.now() + HISTORY_CACHE_TTL_MS,
            page: pageResult,
          };
        }),
        finalize(() => {
          this.historyRequest = null;
          this.historyRequestKey = null;
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );

    return this.historyRequest;
  }

  /**
   * Marca una notificación como leída y refresca el unread-count local.
   * @param id - ID de la notificación.
   */
  markRead(id: string): Observable<void> {
    return this.api
      .post<void>(`notifications/${id}/read`)
      .pipe(tap(() => this.refreshUnreadCount()));
  }

  /** Marca todas las notificaciones del usuario como leídas. */
  markAllRead(): Observable<void> {
    return this.api
      .post<void>('notifications/read-all')
      .pipe(tap(() => this.unreadCount.set(0)));
  }

  /**
   * Borra una notificación del historial y refresca el contador local.
   * @param id - ID de la notificación.
   */
  delete(id: string): Observable<void> {
    return this.api.delete<void>(`notifications/${id}`).pipe(
      tap(() => this.invalidateHistoryCache()),
      tap(() => this.refreshUnreadCount()),
    );
  }

  /** Borra todas las notificaciones del usuario autenticado. */
  deleteAll(): Observable<void> {
    return this.api.delete<void>('notifications').pipe(
      tap(() => {
        this.invalidateHistoryCache();
        this.unreadCount.set(0);
      }),
    );
  }

  /** Limpia el cache de historial para forzar la próxima lectura desde API. */
  invalidateHistoryCache(): void {
    this.historyCache = null;
  }

  /** Actualiza el contador y descarta historial cacheado si entraron cambios externos. */
  private setUnreadCount(count: number): void {
    if (count !== this.unreadCount()) {
      this.invalidateHistoryCache();
    }
    this.unreadCount.set(count);
  }

  /** Lee las 6 preferencias de notificación (config global, solo ADMIN) usando cache de sesión. */
  getPreferences(forceRefresh = false): Observable<NotificationPreference[]> {
    if (!forceRefresh && this.preferencesCache) {
      return of(this.preferencesCache);
    }
    if (!forceRefresh && this.preferencesRequest) {
      return this.preferencesRequest;
    }

    this.preferencesRequest = this.api
      .get<NotificationPreference[]>('notifications/preferences')
      .pipe(
        tap((preferences) => {
          this.preferencesCache = preferences;
        }),
        finalize(() => {
          this.preferencesRequest = null;
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );

    return this.preferencesRequest;
  }

  /**
   * Actualiza la preferencia de un tipo de notificación.
   * @param type - Tipo de notificación a actualizar.
   * @param data - Campos a modificar (parciales).
   */
  updatePreference(
    type: NotificationType,
    data: Partial<
      Pick<NotificationPreference, 'enabled' | 'email_enabled' | 'frequency'>
    >,
  ): Observable<NotificationPreference> {
    return this.api
      .put<NotificationPreference>(`notifications/preferences/${type}`, data)
      .pipe(
        tap((updatedPreference) =>
          this.updatePreferencesCache(updatedPreference),
        ),
      );
  }

  /** Actualiza el cache local de preferencias después de guardar una preferencia. */
  private updatePreferencesCache(
    updatedPreference: NotificationPreference,
  ): void {
    if (!this.preferencesCache) return;

    this.preferencesCache = this.preferencesCache.map((preference) =>
      preference.type === updatedPreference.type
        ? updatedPreference
        : preference,
    );
  }
}
