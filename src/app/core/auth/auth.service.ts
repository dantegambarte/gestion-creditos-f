import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  catchError,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { ApiHttpService } from '../http/api-http.service';
import { AuthUser } from '../models/interface/auth-user';
import { UserRole, UserRoleEnum } from '../models/types/user-role';
import { environment } from '../../../environments/environment';
import { AuthServiceBase } from './auth-service.base';
import { AppRoutes } from '../../shared/models/enums/routes.enum';
import { MessageService } from 'primeng/api';
import {
  LoginCredentials,
  LoginResponseData,
  MeResponseData,
} from '../models/interface/login';

const isBrowser = typeof localStorage !== 'undefined';

@Injectable()
export class AuthService extends AuthServiceBase {
  private readonly api = inject(ApiHttpService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  private readonly TOKEN_KEY = environment.tokenKey;
  private readonly USER_KEY = 'sgcf_user';

  private _user$ = new BehaviorSubject<AuthUser | null>(this.readStoredUser());
  readonly currentUser$ = this._user$.asObservable();

  /**
   * Inicia sesión con las credenciales proporcionadas.
   * @param credentials
   * @returns
   */
  login(credentials: LoginCredentials): Observable<AuthUser> {
    return this.api.post<LoginResponseData>('auth/login', credentials).pipe(
      map((data) => this.mapLoginUser(data)),
      tap((user) => this.persist(user)),
    );
  }

  /**
   * Cierra la sesión del usuario actual, limpia el estado local y muestra confirmación.
   */
  logout(): void {
    this.api
      .post<void>(AppRoutes.AUTH_LOGOUT)
      .pipe(catchError(() => of(null)))
      .subscribe();
    this.clear();
    this.messageService.add({ severity: 'success', summary: 'Sesión cerrada' });
    this.router.navigate([AppRoutes.LOGIN]);
  }

  /**
   * Verifica si el usuario actual tiene un rol específico.
   * @param role
   * @returns
   */
  hasRole(role: UserRole): boolean {
    return this._user$.value?.roles.includes(role) ?? false;
  }

  /**
   * Verifica si el usuario actual tiene alguno de los roles especificados.
   * @param roles
   * @returns
   */
  hasAnyRole(roles: UserRole[]): boolean {
    return roles.some((role) => this.hasRole(role));
  }

  /**
   * Verifica si el usuario actual está autenticado.
   * @returns
   */
  isAuthenticated(): boolean {
    return !!this._user$.value;
  }

  /**
   * Devuelve una instantánea del usuario autenticado actualmente, o null si no hay ninguno.
   */
  get snapshot(): AuthUser | null {
    return this._user$.value;
  }

  /**
   * Devuelve el token de autenticación del usuario actual, o null si no hay ninguno.
   * @returns
   */
  get token(): string | null {
    return isBrowser ? localStorage.getItem(this.TOKEN_KEY) : null;
  }

  /**
   * Restaura la sesión del usuario actual.
   * @returns
   */
  restoreSession(): Observable<void> {
    if (!this.token) return of(undefined);

    return this.api.get<MeResponseData>('auth/me').pipe(
      tap((me) => {
        const user = this.mapMeUser(me, this.token!);
        this.persist(user);
      }),
      map(() => undefined),
      catchError(() => {
        this.clear();
        return of(undefined);
      }),
    );
  }

  clearSession(): void {
    this.clear();
  }

  patchCurrentUser(update: Partial<AuthUser>): void {
    const currentUser = this._user$.value;
    if (!currentUser) return;
    const patchedUser = { ...currentUser, ...update };
    this.persist(patchedUser);
  }

  /**
   * Cambia la contraseña del usuario actual.
   * @param currentPassword
   * @param newPassword
   * @returns
   */
  changePassword(
    currentPassword: string,
    newPassword: string,
  ): Observable<void> {
    return this.api
      .patch<void>('users/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      .pipe(
        switchMap(() => this.api.get<MeResponseData>('auth/me')),
        tap((me) => {
          const user = this.mapMeUser(me, this.token!);
          this.persist(user);
          this.redirectByRole(user.roles);
        }),
        map(() => undefined),
      );
  }

  /**
   * Redirige al usuario según su rol.
   * @param roles
   * @returns
   */
  private redirectByRole(roles: UserRole[]): void {
    if (roles.includes(UserRoleEnum.ADMIN))
      return void this.router.navigate([AppRoutes.DASHBOARD]);
    if (roles.includes(UserRoleEnum.SELLER))
      return void this.router.navigate([AppRoutes.OPERATIONS]);
    if (roles.includes(UserRoleEnum.COLLECTOR))
      return void this.router.navigate([AppRoutes.ROUTE]);
    // SELLER_COLLECTOR arranca en Mi Ruta (cobranza como tarea principal).
    if (roles.includes(UserRoleEnum.SELLER_COLLECTOR))
      return void this.router.navigate([AppRoutes.ROUTE]);
    this.router.navigate([AppRoutes.LOGIN]);
  }

  /**
   * Mapea los datos de respuesta de login a un objeto AuthUser.
   * @param data
   * @returns
   */
  private mapLoginUser(data: LoginResponseData): AuthUser {
    return {
      id: data.user.id,
      full_name: data.user.full_name,
      name: data.user.full_name,
      dni: data.user.dni,
      email: data.user.email,
      phone: data.user.phone,
      address: data.user.address,
      status: data.user.status,
      last_login_at: data.user.last_login_at,
      created_at: data.user.created_at,
      roles: [data.user.role as UserRole],
      avatar: this.initials(data.user.full_name),
      is_temp_password: data.user.is_temp_password,
      force_relogin_at: null,
      token: data.token,
    };
  }

  /**
   * Mapea los datos de respuesta de la ruta 'auth/me' a un objeto AuthUser.
   * @param me
   * @param token
   * @returns
   */
  private mapMeUser(me: MeResponseData, token: string): AuthUser {
    return {
      id: me.id,
      full_name: me.full_name,
      name: me.full_name,
      dni: me.dni,
      email: me.email,
      phone: me.phone,
      address: me.address,
      status: me.status,
      last_login_at: me.last_login_at,
      created_at: me.created_at,
      roles: [me.role as UserRole],
      avatar: this.initials(me.full_name),
      is_temp_password: me.is_temp_password,
      force_relogin_at: me.force_relogin_at ?? null,
      pending_approvals_count: me.pending_approvals_count,
      token,
    };
  }

  /**
   * Genera las iniciales del nombre completo del usuario.
   * @param fullName
   * @returns
   */
  private initials(fullName: string): string {
    return fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('');
  }

  /**
   * Almacena la información del usuario en el almacenamiento local.
   * @param user
   * @returns
   */
  private persist(user: AuthUser): void {
    if (!isBrowser) return;
    localStorage.setItem(this.TOKEN_KEY, user.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this._user$.next(user);
  }

  /**
   * Limpia la información del usuario del almacenamiento local y del estado de la aplicación.
   */
  private clear(): void {
    if (isBrowser) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
    this._user$.next(null);
  }

  /**
   * Lee la información del usuario del almacenamiento local.
   * @returns
   */
  private readStoredUser(): AuthUser | null {
    if (!isBrowser) return null;
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
