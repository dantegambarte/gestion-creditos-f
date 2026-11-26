import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import { ApiHttpService } from '../http/api-http.service';
import { AuthUser } from '../models/interface/auth-user';
import { UserRole } from '../models/types/user-role';
import { landingRouteForRoles } from './role-routes';
import { AuthServiceBase } from './auth-service.base';
import { AppRoutes } from '../../shared/models/enums/routes.enum';
import { MessageService } from 'primeng/api';
import { AccessTokenStore, isSessionRejected } from './access-token.store';
import { TokenRefreshService } from './token-refresh.service';
import { LoginCredentials, LoginResponseData, MeResponseData } from '../models/interface/login';

const isBrowser = typeof localStorage !== 'undefined';

@Injectable()
export class AuthService extends AuthServiceBase {
  private readonly api = inject(ApiHttpService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly tokens = inject(AccessTokenStore);
  private readonly tokenRefresh = inject(TokenRefreshService);

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
   * Si el servidor no confirma el cierre, la sesión local se cierra igual y se avisa.
   */
  logout(): void {
    this.api
      .post<void>(AppRoutes.AUTH_LOGOUT)
      .pipe(
        catchError(() => {
          this.messageService.add({
            severity: 'warn',
            summary: 'Cierre parcial',
            detail: 'Cerraste sesión en este dispositivo, pero el servidor no lo confirmó.',
          });
          return of(null);
        }),
      )
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
   * Devuelve el access token en memoria del usuario actual, o null si no hay ninguno.
   */
  get token(): string | null {
    return this.tokens.get(false);
  }

  /**
   * Restaura la sesión al iniciar la app: obtiene un access token nuevo con la
   * cookie HttpOnly del refresh token y recarga el perfil con auth/me.
   * Sólo cierra la sesión si el backend la rechaza (401/403); ante un corte de
   * red o un 5xx conserva el perfil guardado para no expulsar al usuario.
   */
  restoreSession(): Observable<void> {
    this.tokens.removeLegacyTokens();
    if (!this._user$.value) return of(undefined);

    return this.tokenRefresh.refreshInternal().pipe(
      tap((token) => this.tokens.set(false, token)),
      switchMap((token) =>
        this.api.get<MeResponseData>('auth/me').pipe(map((me) => this.mapMeUser(me, token))),
      ),
      tap((user) => this.persist(user)),
      map(() => undefined),
      catchError((err) => {
        if (isSessionRejected(err)) this.clear();
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
  changePassword(currentPassword: string, newPassword: string): Observable<void> {
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
   * Redirige al usuario a la ruta de aterrizaje absoluta de su rol.
   * @param roles - Roles del usuario recién actualizado.
   */
  private redirectByRole(roles: UserRole[]): void {
    this.router.navigate([landingRouteForRoles(roles)]);
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
   * Guarda el token sólo en memoria y el perfil (sin token) en localStorage,
   * para poder restaurar la sesión vía refresh al recargar.
   * @param user - usuario autenticado, con su access token
   */
  private persist(user: AuthUser): void {
    this.tokens.set(false, user.token || null);
    if (isBrowser) {
      const profile: Partial<AuthUser> = { ...user };
      delete profile.token;
      localStorage.setItem(this.USER_KEY, JSON.stringify(profile));
    }
    this._user$.next(user);
  }

  /**
   * Limpia la información del usuario del almacenamiento local y del estado de la aplicación.
   */
  private clear(): void {
    this.tokens.set(false, null);
    if (isBrowser) {
      this.tokens.removeLegacyTokens();
      localStorage.removeItem(this.USER_KEY);
    }
    this._user$.next(null);
  }

  /**
   * Lee el perfil guardado en localStorage; el token nunca se restaura desde ahí.
   */
  private readStoredUser(): AuthUser | null {
    if (!isBrowser) return null;
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? { ...(JSON.parse(raw) as AuthUser), token: '' } : null;
    } catch {
      return null;
    }
  }
}
