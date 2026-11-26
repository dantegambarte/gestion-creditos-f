import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { portalAuthGuard } from './portal-auth.guard';
import { portalLoginGuard } from './portal-login.guard';
import { portalTempPasswordGuard } from './portal-temp-password.guard';
import { PortalAuthService } from './portal-auth.service';

describe('portal guards', () => {
  let authenticated: boolean;
  let snapshot: { portalIsTempPassword?: boolean } | null;

  /**
   * Configura TestBed con un PortalAuthService simulado y la plataforma indicada.
   * @param platform - 'browser' o 'server' para simular SSR.
   */
  function setup(platform = 'browser'): void {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platform },
        {
          provide: PortalAuthService,
          useValue: {
            isAuthenticated: () => authenticated,
            get snapshot() {
              return snapshot;
            },
          },
        },
      ],
    });
  }

  /**
   * Ejecuta un guard en contexto de inyección y devuelve la URL si redirige.
   * @returns `true` si deja pasar, o la URL serializada de redirección.
   */
  function run(guard: CanActivateFn): true | string {
    const result = TestBed.runInInjectionContext(() => guard({} as never, {} as never));
    if (result instanceof UrlTree) return TestBed.inject(Router).serializeUrl(result);
    expect(result).toBeTrue();
    return true;
  }

  beforeEach(() => {
    authenticated = false;
    snapshot = null;
  });

  describe('portalAuthGuard', () => {
    it('deja pasar a un cliente autenticado', () => {
      authenticated = true;
      setup();
      expect(run(portalAuthGuard)).toBeTrue();
    });

    it('redirige al login del portal sin sesión', () => {
      setup();
      expect(run(portalAuthGuard)).toBe('/portal/login');
    });

    it('no bloquea en SSR aunque no haya sesión', () => {
      setup('server');
      expect(run(portalAuthGuard)).toBeTrue();
    });
  });

  describe('portalLoginGuard', () => {
    it('muestra el login a quien no tiene sesión', () => {
      setup();
      expect(run(portalLoginGuard)).toBeTrue();
    });

    it('manda al dashboard a un cliente ya autenticado', () => {
      authenticated = true;
      setup();
      expect(run(portalLoginGuard)).toBe('/portal/dashboard');
    });
  });

  describe('portalTempPasswordGuard', () => {
    it('redirige a cambio de contraseña con contraseña temporal', () => {
      snapshot = { portalIsTempPassword: true };
      setup();
      expect(run(portalTempPasswordGuard)).toBe('/portal/change-password');
    });

    it('deja pasar con contraseña definitiva o sin sesión', () => {
      snapshot = { portalIsTempPassword: false };
      setup();
      expect(run(portalTempPasswordGuard)).toBeTrue();
      snapshot = null;
      expect(run(portalTempPasswordGuard)).toBeTrue();
    });
  });
});
