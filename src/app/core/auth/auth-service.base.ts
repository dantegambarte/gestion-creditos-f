import { Observable } from 'rxjs';
import { AuthUser } from '../models/interface/auth-user';
import { LoginCredentials } from '../models/interface/login';
import { UserRole } from '../models/types/user-role';

/**
 * Contrato compartido entre MockAuthService y AuthService.
 * Los guards, interceptors y componentes que inyecten MockAuthService
 * reciben una implementación de esta clase gracias al factory en auth.provider.ts.
 */
export abstract class AuthServiceBase {
  abstract readonly currentUser$: Observable<AuthUser | null>;

  abstract login(credentials: LoginCredentials): Observable<AuthUser>;
  abstract logout(): void;
  abstract hasRole(role: UserRole): boolean;
  abstract hasAnyRole(roles: UserRole[]): boolean;
  abstract isAuthenticated(): boolean;
  abstract get snapshot(): AuthUser | null;
  abstract get token(): string | null;
  abstract patchCurrentUser(update: Partial<AuthUser>): void;

  /**
   * Restaura la sesión al iniciar la app.
   * - Mock: retorna of(undefined) inmediatamente.
   * - Real: llama GET /api/auth/me; si 401, limpia storage y emite null.
   * Usado en APP_INITIALIZER.
   */
  abstract restoreSession(): Observable<void>;
  abstract clearSession(): void;
  abstract changePassword(
    currentPassword: string,
    newPassword: string,
  ): Observable<void>;
}
