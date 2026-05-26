import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ApiHttpService } from '../../../core/http/api-http.service';
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
  private readonly TOKEN_KEY = environment.portalTokenKey;
  private readonly CUSTOMER_KEY = 'sgcf_portal_customer';

  private _customer$ = new BehaviorSubject<PortalCustomer | null>(null);
  readonly currentCustomer$ = this._customer$.asObservable();

  constructor() {
    this._bootstrap();
  }

  /**
   * Devuelve el cliente actualmente autenticado o null si no hay ninguno. Este valor se inicializa al cargar el servicio leyendo el token del localStorage y no se actualiza automáticamente si el token cambia fuera de este servicio. Para reactividad, subscribirse a currentCustomer$.
   */
  get snapshot(): PortalCustomer | null {
    return this._customer$.value;
  }

  /**
   * Verifica si el usuario está autenticado. Esto se determina por la presencia de un cliente en el estado actual. No verifica la validez del token ni su expiración, por lo que es posible que retorne true para un token expirado hasta que se intente usar o se recargue la página.
   * @returns
   */
  isAuthenticated(): boolean {
    return !!this._customer$.value;
  }

  /**
   * Inicia sesión con las credenciales proporcionadas. Si la autenticación es exitosa, almacena el token JWT y la información del cliente en localStorage, y actualiza el estado del cliente en el servicio. El token se espera que contenga las reclamaciones necesarias para reconstruir el objeto PortalCustomer si es necesario. El método retorna un Observable que emite void al completar, o un error si la autenticación falla.
   * @param payload
   * @returns
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
        if (isBrowser) {
          localStorage.setItem(this.TOKEN_KEY, res.token);
          localStorage.setItem(this.CUSTOMER_KEY, JSON.stringify(customer));
        }
        this._customer$.next(customer);
      }),
      map(() => undefined),
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
   * Cierra la sesión del usuario. Elimina el token JWT y la información del cliente del localStorage, y actualiza el estado del cliente en el servicio. Retorna un Observable que emite void al completar. Si la llamada a la API de logout falla, el método aún limpiará el estado local para asegurar que el usuario quede desconectado en la interfaz, aunque idealmente se debería manejar el error para informar al usuario.
   * @returns
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
    if (isBrowser) {
      localStorage.setItem(this.CUSTOMER_KEY, JSON.stringify(updated));
    }
    this._customer$.next(updated);
  }

  /**
   * Limpia la sesión del usuario.
   */
  private _clearSession(): void {
    if (isBrowser) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.CUSTOMER_KEY);
    }
    this._customer$.next(null);
  }

  /**
   * Inicializa el servicio de autenticación.
   * @returns
   */
  private _bootstrap(): void {
    if (!isBrowser) return;

    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return;

    // Decodificar y validar el JWT una sola vez.
    let jwtPayload: Record<string, unknown>;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('invalid jwt');
      jwtPayload = JSON.parse(
        atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
      );
      if (jwtPayload?.['aud'] !== 'portal-cliente')
        throw new Error('wrong audience');
    } catch {
      this._clearSession();
      return;
    }

    const stored = localStorage.getItem(this.CUSTOMER_KEY);
    if (stored) {
      try {
        this._customer$.next(JSON.parse(stored) as PortalCustomer);
      } catch {
        this._clearSession();
      }
    } else {
      try {
        const customer: PortalCustomer = {
          id: String(jwtPayload['sub'] ?? ''),
          fullName: String(jwtPayload['full_name'] ?? jwtPayload['name'] ?? ''),
          dni: String(jwtPayload['dni'] ?? ''),
          portalIsTempPassword: Boolean(
            jwtPayload['portal_is_temp_password'] ?? false,
          ),
        };
        this._customer$.next(customer);
      } catch {
        this._clearSession();
      }
    }
  }
}
