import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthUser } from '../models/interface/auth-user';
import { AuthServiceBase } from './auth-service.base';
import { tempPasswordGuard } from './temp-password.guard';

describe('tempPasswordGuard', () => {
  let snapshot: AuthUser | null;
  const executeGuard: CanActivateFn = (...params) =>
    TestBed.runInInjectionContext(() => tempPasswordGuard(...params));

  beforeEach(() => {
    snapshot = null;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthServiceBase,
          useValue: {
            get snapshot() {
              return snapshot;
            },
          },
        },
      ],
    });
  });

  it('redirige a change-password cuando el usuario tiene contraseña temporal', () => {
    snapshot = { is_temp_password: true } as AuthUser;

    const result = executeGuard({} as never, {} as never);

    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/change-password');
  });

  it('deja pasar cuando la contraseña ya no es temporal', () => {
    snapshot = { is_temp_password: false } as AuthUser;

    expect(executeGuard({} as never, {} as never)).toBeTrue();
  });

  it('deja pasar cuando no hay usuario en sesión', () => {
    expect(executeGuard({} as never, {} as never)).toBeTrue();
  });
});
