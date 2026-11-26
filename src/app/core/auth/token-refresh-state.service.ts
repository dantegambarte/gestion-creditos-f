import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  Subject,
  filter,
  race,
  switchMap,
  take,
  throwError,
} from 'rxjs';

/**
 * Estado de un refresh en curso para una sesión (interna o portal).
 */
export class RefreshSessionState {
  isRefreshing = false;
  readonly tokenSubject = new BehaviorSubject<string | null>(null);
  private readonly failed$ = new Subject<unknown>();

  /**
   * Marca el inicio de un refresh.
   */
  start(): void {
    this.isRefreshing = true;
    this.tokenSubject.next(null);
  }

  /**
   * Publica el token nuevo a las requests encoladas.
   * @param token - access token renovado
   */
  succeed(token: string): void {
    this.isRefreshing = false;
    this.tokenSubject.next(token);
  }

  /**
   * Hace fallar a las requests encoladas con el error del refresh.
   * @param err - error devuelto por el endpoint de refresh
   */
  fail(err: unknown): void {
    this.isRefreshing = false;
    this.tokenSubject.next(null);
    this.failed$.next(err);
  }

  /**
   * Espera el resultado del refresh en curso: emite el token nuevo o
   * propaga el error si el refresh falló (las requests no quedan colgadas).
   * @returns el próximo token renovado
   */
  waitForToken(): Observable<string> {
    return race(
      this.tokenSubject.pipe(
        filter((t): t is string => t !== null),
        take(1),
      ),
      this.failed$.pipe(
        take(1),
        switchMap((err) => throwError(() => err)),
      ),
    );
  }
}

/**
 * Encapsula el estado de refresh de token para serializar requests concurrentes,
 * separado por sesión: el refresh del portal no bloquea ni contamina al interno.
 * Al ser providedIn: 'root', Angular crea una instancia por injector de request
 * en SSR, evitando que el estado se comparta entre usuarios en el servidor.
 */
@Injectable({ providedIn: 'root' })
export class TokenRefreshStateService {
  private readonly internal = new RefreshSessionState();
  private readonly portal = new RefreshSessionState();

  /**
   * Devuelve el estado de refresh de la sesión indicada.
   * @param isPortal - true para el portal del cliente
   */
  forSession(isPortal: boolean): RefreshSessionState {
    return isPortal ? this.portal : this.internal;
  }
}
