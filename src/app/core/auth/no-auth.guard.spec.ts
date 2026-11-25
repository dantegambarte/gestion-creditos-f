import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AuthServiceBase } from './auth-service.base';
import { noAuthGuard } from './no-auth.guard';

describe('noAuthGuard', () => {
  /** Ejecuta el guard con un usuario autenticado que tiene los roles dados. */
  const runWith = (roles: string[] | null) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthServiceBase,
          useValue: {
            isAuthenticated: () => roles !== null,
            snapshot: roles ? { roles } : null,
          },
        },
      ],
    });
    return TestBed.runInInjectionContext(() => noAuthGuard({} as never, {} as never));
  };

  it('deja pasar a quien no está autenticado', () => {
    expect(runWith(null)).toBeTrue();
  });

  const cases: Array<[string, string]> = [
    ['ADMIN', '/admin/dashboard'],
    ['SELLER', '/seller/operations'],
    ['COLLECTOR', '/collector/route'],
    ['SELLER_COLLECTOR', '/collector/route'],
  ];
  cases.forEach(([role, expected]) => {
    it(`redirige ${role} a ${expected}`, () => {
      const result = runWith([role]);
      expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(expected);
    });
  });

  it('CASHIER sin área propia puede ver el login sin bucle de redirección', () => {
    expect(runWith(['CASHIER'])).toBeTrue();
  });
});
