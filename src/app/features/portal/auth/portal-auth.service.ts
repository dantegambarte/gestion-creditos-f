import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiHttpService } from '../../../core/http/api-http.service';
import { AccessTokenStore, isSessionRejected } from '../../../core/auth/access-token.store';
import { TokenRefreshService } from '../../../core/auth/token-refresh.service';
import { LoginResponseRaw } from '../models/interface/login.interface';
import {
  PortalChangePasswordPayload,
  PortalCustomer,
  PortalLoginPayload,
} from '../models/portal.models';

const isBrowser = typeof localStorage !== 'undefined';

@Injectable({ providedIn: 'root' })
export class PortalAuthService {
  private readonly api = inject(ApiHttpService);
  private readonly tokens = inject(AccessTokenStore);
  private readonly tokenRefresh = inject(TokenRefreshService);
  private readonly CUSTOMER_KEY = 'sgcf_portal_customer';

  private _customer$ = new BehaviorSubject<PortalCustomer | null>(null);
  readonly currentCustomer$ = this._customer$.asObservable();

  constructor() {
    this._bootstrap();
  }

  /**
   * Devuelve el cliente actualmente autenticado o null si no hay ninguno.
   * Para reactividad, subscribirse a currentCustomer$.
   */
  get snapshot(): PortalCustomer | null {
    return this._customer$.value;
  }

  /**
   * Verifica si hay un cliente en el estado actual. No valida el access token:
   * si venció, el error interceptor lo renueva con el refresh token.
   */
  isAuthenticated(): boolean {
    return !!this._customer$.value;
  }

  /**
   * Inicia sesión. El access token queda sólo en memoria (#39) y en localStorage
   * se guarda únicamente el perfil del cliente, para restaurar la sesión al recargar.
   * @param payload - DNI y contraseña del cliente
   */
  login(payload: PortalLoginPayload): Observable<void> {
    return this.api.post<LoginResponseRaw>('auth/portal/login', payload).pipe(
      tap((res) => {
        const customer: PortalCustomer = {
          id: res.customer.id,
          fullName: res.customer.full_name,
          dni: res.customer.dni,
          portalIsTempPassword: res.customer.portal_is_temp_password,
        };
        this.tokens.set(true, res.token);
        this._storeCustomer(customer);
        this._customer$.next(customer);
      }),
      map(() => undefined),
    );
  }

  /**
   * Restaura la sesión del portal al iniciar la app pidiendo un access token
   * nuevo con la cookie HttpOnly. Sólo cierra la sesión si el backend la
   * rechaza (401/403); un corte de red conserva el perfil guardado.
   */
  restoreSession(): Observable<void> {
    this.tokens.removeLegacyTokens();
    if (!this._customer$.value) return of(undefined);

    return this.tokenRefresh.refreshPortal().pipe(
      tap((token) => this.tokens.set(true, token)),
      map(() => undefined),
      catchError((err) => {
        if (isSessionRejected(err)) this._clearSession();
        return of(undefined);
      }),
    );
  }

  /**
   * Cambia la contraseña del cliente autenticado. Al completar exitosamente,
   * actualiza el flag portalIsTempPassword a false tanto en memoria como en localStorage.
   * @param payload
   * @returns
   */
  changePassword(payload: PortalChangePasswordPayload): Observable<void> {
    return this.api.post<null>('auth/portal/change-password', payload).pipe(
      tap(() => this._markPasswordChanged()),
      map(() => undefined),
    );
  }

  /**
   * Cierra la sesión del cliente. Aunque la llamada al backend falle, limpia
   * el estado local para que el cliente quede desconectado en la interfaz.
   */
  logout(): Observable<void> {
    return this.api.post<null>('auth/portal/logout').pipe(
      tap({
        next: () => this._clearSession(),
        error: () => this._clearSession(),
      }),
      map(() => undefined),
    );
  }

  /**
   * Marca la contraseña del cliente como permanente en memoria y localStorage.
   */
  private _markPasswordChanged(): void {
    const current = this._customer$.value;
    if (!current) return;
    const updated: PortalCustomer = { ...current, portalIsTempPassword: false };
    this._storeCustomer(updated);
    this._customer$.next(updated);
  }

  /**
   * Guarda el perfil del cliente (nunca el token) en localStorage.
   * @param customer - cliente autenticado
   */
  private _storeCustomer(customer: PortalCustomer): void {
    if (isBrowser) localStorage.setItem(this.CUSTOMER_KEY, JSON.stringify(customer));
  }

  /**
   * Limpia el token en memoria, el perfil guardado y el estado del cliente.
   */
  private _clearSession(): void {
    this.tokens.set(true, null);
    if (isBrowser) {
      this.tokens.removeLegacyTokens();
      localStorage.removeItem(this.CUSTOMER_KEY);
    }
    this._customer$.next(null);
  }

  /**
   * Rehidrata el perfil guardado para que los guards vean la sesión al recargar;
   * el access token se recupera después con restoreSession().
   */
  private _bootstrap(): void {
    if (!isBrowser) return;

    const stored = localStorage.getItem(this.CUSTOMER_KEY);
    if (!stored) return;
    try {
      this._customer$.next(JSON.parse(stored) as PortalCustomer);
    } catch {
      this._clearSession();
    }
  }
}
