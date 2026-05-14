import { Provider } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { AuthServiceBase } from '../auth-service.base';
import { MockAuthService } from '../mock-auth.service';
import { AuthUser } from '../../models/interface/auth-user';

const DEFAULT_ADMIN: AuthUser = {
  id: 'usr-001',
  full_name: 'Test Admin',
  name: 'Test Admin',
  dni: '12345678',
  email: 'admin@test.com',
  avatar: 'TA',
  roles: ['ADMIN'],
  is_temp_password: false,
  force_relogin_at: null,
  token: 'test-token',
};

/**
 * Providers mínimos para specs que renderizan componentes con AuthServiceBase.
 * @param user - usuario simulado (default: ADMIN). Pasar null para sesión vacía.
 */
export function provideAuthTesting(user: AuthUser | null = DEFAULT_ADMIN): Provider[] {
  const user$ = new BehaviorSubject<AuthUser | null>(user);

  const stub: Partial<MockAuthService> = {
    currentUser$: user$.asObservable(),
    snapshot: user,
    isAuthenticated: () => !!user,
    hasRole: (role) => user?.roles.includes(role) ?? false,
    hasAnyRole: (roles) => roles.some((r) => user?.roles.includes(r)) ?? false,
    token: user ? 'test-token' : null,
    login: () => of(user!),
    logout: () => {},
    restoreSession: () => of(undefined),
    clearSession: () => {},
    changePassword: () => of(undefined),
  };

  return [
    { provide: MockAuthService, useValue: stub },
    { provide: AuthServiceBase, useExisting: MockAuthService },
  ];
}
