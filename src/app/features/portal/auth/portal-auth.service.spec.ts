import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { PortalAuthService } from './portal-auth.service';
import { environment } from '../../../../environments/environment';
import { provideAuthTesting } from '../../../core/auth/testing/auth-testing';

// Minimal base64url-encoded JWT with exp in far future and required portal audience
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256' }));
  const body = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, aud: 'portal-cliente', ...payload }));
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

    expect(localStorage.getItem(TOKEN_KEY)).toBe('portal_jwt_token');
    expect(localStorage.getItem(environment.tokenKey)).toBeNull();
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
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ id: 'c-001', fullName: 'Ana', dni: '12345678', portalIsTempPassword: false }));

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
    req.flush({ ok: false, message: 'error', data: null }, { status: 500, statusText: 'Server Error' });

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('bootstrap rehydrates customer from stored object if token not expired', () => {
    const token = makeJwt({ sub: 'c-001' });
    const customer = { id: 'c-001', fullName: 'Ana García', dni: '12345678', portalIsTempPassword: false };
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));

    // Re-create service to trigger bootstrap
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [PortalAuthService, provideHttpClient(), provideHttpClientTesting(), ...provideAuthTesting()],
    });
    const freshService = TestBed.inject(PortalAuthService);

    expect(freshService.isAuthenticated()).toBeTrue();
    expect(freshService.snapshot?.fullName).toBe('Ana García');
  });

  it('bootstrap mantiene sesión activa con token expirado (refresh interceptor lo maneja)', () => {
    // El servicio NO limpia tokens expirados en bootstrap — el error interceptor
    // detecta TOKEN_EXPIRED en la primera llamada y hace el refresh.
    // Si se limpiaría aquí, el refresh nunca ocurriría.
    const expiredJwt = btoa(JSON.stringify({ alg: 'HS256' })) + '.' +
      btoa(JSON.stringify({ sub: 'c-001', aud: 'portal-cliente', exp: Math.floor(Date.now() / 1000) - 60 })) + '.sig';
    localStorage.setItem(TOKEN_KEY, expiredJwt);
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ id: 'c-001', fullName: 'Ana', dni: '12345678', portalIsTempPassword: false }));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [PortalAuthService, provideHttpClient(), provideHttpClientTesting(), ...provideAuthTesting()],
    });
    const freshService = TestBed.inject(PortalAuthService);

    expect(freshService.isAuthenticated()).toBeTrue();
    expect(freshService.snapshot?.fullName).toBe('Ana');
  });
});
