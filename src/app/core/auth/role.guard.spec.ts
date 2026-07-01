import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { AuthUser } from '../models/interface/auth-user';
import { UserRole } from '../models/types/user-role';
import { AuthServiceBase } from './auth-service.base';

import { defaultRouteForUser, roleGuard } from './role.guard';

describe('roleGuard', () => {
  let auth: jasmine.SpyObj<AuthServiceBase>;
  let router: jasmine.SpyObj<Router>;
  let messageService: jasmine.SpyObj<MessageService>;
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => roleGuard(...guardParameters));

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthServiceBase>(
      'AuthServiceBase',
      ['hasAnyRole'],
      {
        currentUser$: of(null),
        snapshot: userWithRoles(['SELLER']),
      },
    );
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    messageService = jasmine.createSpyObj<MessageService>('MessageService', [
      'add',
    ]);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthServiceBase, useValue: auth },
        { provide: Router, useValue: router },
        { provide: MessageService, useValue: messageService },
      ],
    });
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });

  it('permite activar la ruta cuando no declara roles requeridos', () => {
    const route = routeWithRoles(undefined);

    const result = executeGuard(route, {} as never);

    expect(result).toBeTrue();
    expect(auth.hasAnyRole).not.toHaveBeenCalled();
  });

  it('permite activar la ruta cuando el usuario tiene algún rol requerido', () => {
    auth.hasAnyRole.and.returnValue(true);
    const route = routeWithRoles(['ADMIN', 'SELLER']);

    const result = executeGuard(route, {} as never);

    expect(result).toBeTrue();
    expect(auth.hasAnyRole).toHaveBeenCalledOnceWith(['ADMIN', 'SELLER']);
    expect(messageService.add).not.toHaveBeenCalled();
  });

  it('muestra toast, redirige y bloquea cuando faltan privilegios', () => {
    auth.hasAnyRole.and.returnValue(false);
    const route = routeWithRoles(['ADMIN']);

    const result = executeGuard(route, {} as never);

    expect(result).toBeFalse();
    expect(messageService.add).toHaveBeenCalledOnceWith({
      severity: 'warn',
      summary: 'Acceso denegado: Privilegios insuficientes',
    });
    expect(router.navigate).toHaveBeenCalledOnceWith(['/seller/operations']);
  });

  it('resuelve fallback seguro por rol', () => {
    expect(defaultRouteForUser(['ADMIN'])).toBe('/admin/dashboard');
    expect(defaultRouteForUser(['SELLER'])).toBe('/seller/operations');
    expect(defaultRouteForUser(['SELLER_COLLECTOR'])).toBe('/seller/operations');
    expect(defaultRouteForUser(['COLLECTOR'])).toBe('/collector/route');
    expect(defaultRouteForUser(undefined)).toBe('/login');
  });
});

/**
 * Construye un snapshot mínimo con roles de ruta para ejecutar el guard.
 * @param roles - Roles requeridos por la ruta bajo prueba.
 */
function routeWithRoles(
  roles: UserRole[] | undefined,
): ActivatedRouteSnapshot {
  return { data: roles ? { roles } : {} } as ActivatedRouteSnapshot;
}

/**
 * Construye un usuario autenticado mínimo con roles para tests de guards.
 * @param roles - Roles asignados al usuario simulado.
 */
function userWithRoles(roles: UserRole[]): AuthUser {
  return { roles } as AuthUser;
}
