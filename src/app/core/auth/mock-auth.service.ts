import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { Roles } from '../../shared/models/enums/roles.enum';
import { AppRoutes } from '../../shared/models/enums/routes.enum';
import { AuthUser } from '../models/interface/auth-user';
import { AuthError } from '../models/interface/auth.error';
import { LoginCredentials } from '../models/interface/login';
import { UserRole, UserRoleEnum } from '../models/types/user-role';
import { AuthServiceBase } from './auth-service.base';

const isBrowser = typeof localStorage !== 'undefined';

// ── Usuarios mock ─────────────────────────────────────────────────────────────
// MODO MOCK — solo para desarrollo/testing. NO usar en producción.
// Credenciales: DNI + contraseña "1234" para todos los usuarios.
// quickAccess en login.component usa estos DNIs.
// 'mock123' — 6 chars, pasa Validators.minLength(6) del formulario de login
export const MOCK_PASSWORD = 'mock123';

export const MOCK_USERS: AuthUser[] = [
  {
    id: 'usr-001',
    full_name: 'Carlos López',
    name: 'Carlos López',
    dni: '12345678',
    email: 'admin@siscreditos.com',
    avatar: 'CL',
    roles: [Roles.ADMIN],
    is_temp_password: false,
    force_relogin_at: null,
    token:
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAxIiwicm9sZSI6IkFETUlOIiwiYXVkIjoic2lzdGVtYS1pbnRlcm5vIn0.mock_admin',
  },
  {
    id: 'usr-002',
    full_name: 'María Sánchez',
    name: 'María Sánchez',
    dni: '87654321',
    email: 'vendedor@siscreditos.com',
    avatar: 'MS',
    roles: ['SELLER'],
    is_temp_password: false,
    force_relogin_at: null,
    token:
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAyIiwicm9sZSI6IlNFTExFUiIsImF1ZCI6InNpc3RlbWEtaW50ZXJubyJ9.mock_seller',
  },
  {
    id: 'usr-003',
    full_name: 'Juan Pedraza',
    name: 'Juan Pedraza',
    dni: '11223344',
    email: 'cobrador@siscreditos.com',
    avatar: 'JP',
    roles: ['COLLECTOR'],
    is_temp_password: false,
    force_relogin_at: null,
    token:
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAzIiwicm9sZSI6IkNPTExFQ1RPUiIsImF1ZCI6InNpc3RlbWEtaW50ZXJubyJ9.mock_collector',
  },
  {
    id: 'usr-004',
    full_name: 'Ana Romero',
    name: 'Ana Romero',
    dni: '55667788',
    email: 'vendedor.cobrador@siscreditos.com',
    avatar: 'AR',
    roles: ['SELLER_COLLECTOR'],
    is_temp_password: false,
    force_relogin_at: null,
    token:
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDA0Iiwicm9sZSI6IlNFTExFUl9DT0xMRUNUT1IiLCJhdWQiOiJzaXN0ZW1hLWludGVybm8ifQ.mock_seller_collector',
  },
];

// ── Servicio ──────────────────────────────────────────────────────────────────
@Injectable()
export class MockAuthService extends AuthServiceBase {
  private readonly TOKEN_KEY = 'sgcf_token';
  private readonly USER_KEY = 'sgcf_user';
  readonly NETWORK_LATENCY_MS = 800;

  private _user$ = new BehaviorSubject<AuthUser | null>(this.rehydrate());
  readonly currentUser$ = this._user$.asObservable();

  constructor(private router: Router) {
    super();
  }

  // ── Login — autenticación por DNI + contraseña mock (igual que el backend real) ──
  login(credentials: LoginCredentials): Observable<AuthUser> {
    const match = MOCK_USERS.find((u) => u.dni === credentials.dni);

    if (!match || credentials.password !== MOCK_PASSWORD) {
      return throwError(
        (): AuthError => ({
          status: 401,
          message:
            'Credenciales incorrectas. Verificá tus datos e intentá nuevamente.',
        }),
      ).pipe(delay(this.NETWORK_LATENCY_MS));
    }

    return of(match).pipe(
      delay(this.NETWORK_LATENCY_MS),
      tap((user) => this.persist(user)),
    );
  }

  logout(): void {
    if (isBrowser) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
    this._user$.next(null);
    this.router.navigate([AppRoutes.LOGIN]);
  }

  hasRole(role: UserRole): boolean {
    return this._user$.value?.roles.includes(role) ?? false;
  }

  hasAnyRole(roles: UserRole[]): boolean {
    return roles.some((r) => this.hasRole(r));
  }

  isAuthenticated(): boolean {
    return !!this._user$.value;
  }

  get snapshot(): AuthUser | null {
    return this._user$.value;
  }

  get token(): string | null {
    return isBrowser ? localStorage.getItem(this.TOKEN_KEY) : null;
  }

  // No-op: mock ya rehidrata sincronamente en el constructor.
  restoreSession(): Observable<void> {
    return of(undefined);
  }

  clearSession(): void {
    if (isBrowser) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
    this._user$.next(null);
  }

  patchCurrentUser(update: Partial<AuthUser>): void {
    const currentUser = this._user$.value;
    if (!currentUser) return;
    const patchedUser = { ...currentUser, ...update };
    this.persist(patchedUser);
  }

  changePassword(
    _currentPassword: string,
    _newPassword: string,
  ): Observable<void> {
    const user = this._user$.value;
    if (!user) return of(undefined);

    const updated: AuthUser = { ...user, is_temp_password: false };
    this.persist(updated);

    return of(undefined).pipe(
      delay(this.NETWORK_LATENCY_MS),
      tap(() => this.redirectByRole(updated.roles)),
    );
  }

  private redirectByRole(roles: UserRole[]): void {
    if (roles.includes(UserRoleEnum.ADMIN))
      return void this.router.navigate([AppRoutes.DASHBOARD]);
    if (roles.includes(UserRoleEnum.SELLER))
      return void this.router.navigate([AppRoutes.OPERATIONS]);
    if (roles.includes(UserRoleEnum.COLLECTOR))
      return void this.router.navigate([AppRoutes.ROUTE]);
    if (roles.includes(UserRoleEnum.SELLER_COLLECTOR))
      return void this.router.navigate([AppRoutes.OPERATIONS]);
    this.router.navigate([AppRoutes.LOGIN]);
  }

  private persist(user: AuthUser): void {
    if (isBrowser) {
      localStorage.setItem(this.TOKEN_KEY, user.token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
    this._user$.next(user);
  }

  private rehydrate(): AuthUser | null {
    if (!isBrowser) return null;
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
