import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PortalAuthService } from './portal-auth.service';
import { environment } from '../../../../environments/environment';
import { provideAuthTesting } from '../../../core/auth/testing/auth-testing';
import { AccessTokenStore } from '../../../core/auth/access-token.store';

// Minimal base64url-encoded JWT with exp in far future and required portal audience
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256' }));
  const body = btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: 'portal-cliente',
      ...payload,
    }),
  );
  return `${header}.${body}.sig`;
}

const TOKEN_KEY = environment.portalTokenKey; // 'sgcf_portal_token'
const CUSTOMER_KEY = 'sgcf_portal_customer';

describe('PortalAuthService', () => {
  let service: PortalAuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        PortalAuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideAuthTesting(),
      ],
    });

    service = TestBed.inject(PortalAuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('login() stores token under portalTokenKey (NOT tokenKey)', () => {
    service.login({ dni: '12345678', password: 'pass' }).subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/auth/portal/login`);
    req.flush({
      ok: true,
      message: '',
      data: {
        token: 'portal_jwt_token',
        customer: {
          id: 'c-001',
          full_name: 'Ana García',
          dni: '12345678',
          portal_is_temp_password: false,
        },
      },
    });

    // #39: el token del portal vive sólo en memoria.
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(environment.tokenKey)).toBeNull();
    expect(localStorage.getItem(CUSTOMER_KEY)).not.toContain('portal_jwt_token');
    expect(TestBed.inject(AccessTokenStore).get(true)).toBe('portal_jwt_token');
    expect(TestBed.inject(AccessTokenStore).get(false)).toBeNull();
  });

  it('login() emits the mapped customer', () => {
    let emitted = false;
    service.login({ dni: '12345678', password: 'pass' }).subscribe(() => {
      emitted = true;
    });

    const req = http.expectOne(`${environment.apiBaseUrl}/auth/portal/login`);
    req.flush({
      ok: true,
      message: '',
      data: {
        token: 'portal_jwt_token',
        customer: {
          id: 'c-001',
          full_name: 'Ana García',
          dni: '12345678',
          portal_is_temp_password: true,
        },
      },
    });

    expect(emitted).toBeTrue();
    expect(service.snapshot?.fullName).toBe('Ana García');
    expect(service.snapshot?.portalIsTempPassword).toBeTrue();
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('logout() clears portalTokenKey', () => {
    localStorage.setItem(TOKEN_KEY, 'some_token');
    localStorage.setItem(
      CUSTOMER_KEY,
      JSON.stringify({
        id: 'c-001',
        fullName: 'Ana',
        dni: '12345678',
        portalIsTempPassword: false,
      }),
    );

    service.logout().subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/auth/portal/logout`);
    req.flush({ ok: true, message: '', data: null });

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(environment.tokenKey)).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('logout() clears session even on HTTP error (best-effort)', () => {
    localStorage.setItem(TOKEN_KEY, 'some_token');

    service.logout().subscribe({ error: () => {} });

    const req = http.expectOne(`${environment.apiBaseUrl}/auth/portal/logout`);
    req.flush(
      { ok: false, message: 'error', data: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
  });

  /**
   * Recrea el servicio con un perfil guardado, como al recargar la página.
   * @param legacyToken - token que versiones anteriores dejaban en localStorage
   */
  function reload(legacyToken?: string): PortalAuthService {
    if (legacyToken) localStorage.setItem(TOKEN_KEY, legacyToken);
    localStorage.setItem(
      CUSTOMER_KEY,
      JSON.stringify({
        id: 'c-001',
        fullName: 'Ana García',
        dni: '12345678',
        portalIsTempPassword: false,
      }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PortalAuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideAuthTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(PortalAuthService);
  }

  it('bootstrap rehydrates customer from stored profile', () => {
    const freshService = reload();

    expect(freshService.isAuthenticated()).toBeTrue();
    expect(freshService.snapshot?.fullName).toBe('Ana García');
  });

  it('restoreSession() renueva el token con la cookie y borra el token heredado', () => {
    const freshService = reload(makeJwt({ sub: 'c-001' }));

    freshService.restoreSession().subscribe();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();

    const req = http.expectOne(`${environment.apiBaseUrl}/auth/portal/refresh`);
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ ok: true, data: { token: 'fresh_portal' } });

    expect(TestBed.inject(AccessTokenStore).get(true)).toBe('fresh_portal');
    expect(freshService.isAuthenticated()).toBeTrue();
  });

  it('restoreSession() cierra la sesión si el refresh devuelve 401', () => {
    const freshService = reload();

    freshService.restoreSession().subscribe();
    http
      .expectOne(`${environment.apiBaseUrl}/auth/portal/refresh`)
      .flush(
        { ok: false, code: 'SESSION_REVOKED', message: 'x' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(freshService.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem(CUSTOMER_KEY)).toBeNull();
  });

  it('restoreSession() conserva la sesión ante un corte de red', () => {
    const freshService = reload();

    freshService.restoreSession().subscribe();
    http
      .expectOne(`${environment.apiBaseUrl}/auth/portal/refresh`)
      .error(new ProgressEvent('error'), { status: 0 });

    expect(freshService.isAuthenticated()).toBeTrue();
    expect(localStorage.getItem(CUSTOMER_KEY)).not.toBeNull();
  });

  it('restoreSession() no llama al backend sin sesión guardada', () => {
    service.restoreSession().subscribe();
    http.expectNone(`${environment.apiBaseUrl}/auth/portal/refresh`);
  });
});
