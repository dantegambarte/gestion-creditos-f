import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router } from '@angular/router';

import { authGuard } from './auth.guard';
import { AuthServiceBase } from './auth-service.base';

describe('authGuard', () => {
  let auth: jasmine.SpyObj<AuthServiceBase>;
  let router: jasmine.SpyObj<Router>;
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => authGuard(...guardParameters));

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthServiceBase>('AuthServiceBase', [
      'isAuthenticated',
    ]);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthServiceBase, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });

  it('permite activar rutas privadas cuando el usuario está autenticado', () => {
    auth.isAuthenticated.and.returnValue(true);

    const result = executeGuard({} as never, {} as never);

    expect(result).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirige a login y bloquea la ruta cuando no hay sesión', () => {
    auth.isAuthenticated.and.returnValue(false);

    const result = executeGuard({} as never, {} as never);

    expect(result).toBeFalse();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/login']);
  });
});
