import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { MessageService } from 'primeng/api';
import { environment } from '../../../environments/environment';
import { provideAuthTesting } from '../auth/testing/auth-testing';
import { PortalAuthService } from '../../features/portal/auth/portal-auth.service';
import { portalLoginGuard } from '../../features/portal/auth/portal-login.guard';
import { AuthServiceBase } from '../auth/auth-service.base';
import { NotificationsService } from '../services/notifications.service';
import { AuthService } from '../auth/auth.service';
import { AccessTokenStore } from '../auth/access-token.store';
import { authInterceptor } from './auth.interceptor';
import {
  _httpErrorSummary,
  _isAuthFormRequest,
  _isInternalSessionAlreadyClosed,
  _needsTokenRefresh,
  _redirectToLogin,
  _shouldRedirectToChangePassword,
  errorInterceptor,
} from './error.interceptor';

describe('errorInterceptor helpers', () => {
  it('redirige cuando el backend devuelve 403 de contraseña temporal', () => {
    const err = {
      status: 403,
      error: { message: 'Debés cambiar tu contraseña antes de continuar.' },
    };

    expect(_shouldRedirectToChangePassword(err)).toBeTrue();
  });

  it('no redirige en 403 de permisos genérico', () => {
    const err = {
      status: 403,
      error: { message: 'No tenés permisos para realizar esta acción' },
    };

    expect(_shouldRedirectToChangePassword(err)).toBeFalse();
  });

  it('no redirige para errores sin mensaje de contraseña temporal', () => {
    const err = { status: 403, error: {} };

    expect(_shouldRedirectToChangePassword(err)).toBeFalse();
  });

  it('mapea errores globales a mensajes estándar de usuario', () => {
    expect(_httpErrorSummary(0)).toBe('Error de red o servidor inalcanzable');
    expect(_httpErrorSummary(401)).toBe('Sesión expirada');
    expect(_httpErrorSummary(403)).toBe('No tienes permisos para esta acción');
    expect(_httpErrorSummary(500)).toBe('Error interno del servidor');
    expect(_httpErrorSummary(503)).toBe('Error interno del servidor');
  });

  it('no muestra toast global para errores de dominio que debe manejar la pantalla', () => {
    expect(_httpErrorSummary(400)).toBeNull();
    expect(_httpErrorSummary(404)).toBeNull();
    expect(_httpErrorSummary(undefined)).toBeNull();
  });

  it('detecta 401 tardíos internos cuando el logout ya limpió la sesión', () => {
    expect(_isInternalSessionAlreadyClosed(false, false)).toBeTrue();
    expect(_isInternalSessionAlreadyClosed(true, false)).toBeFalse();
  });

  it('mantiene 401 internos como sesión activa cuando todavía hay usuario', () => {
    expect(_isInternalSessionAlreadyClosed(false, true)).toBeFalse();
  });

  it('pide refresh ante TOKEN_EXPIRED o 401 de una request sin token (tras recargar)', () => {
    const url = 'http://api/api/credits';
    expect(
      _needsTokenRefresh({ status: 401, error: { message: 'TOKEN_EXPIRED' } }, url, true),
    ).toBeTrue();
    expect(_needsTokenRefresh({ status: 401, error: { message: 'x' } }, url, false)).toBeTrue();
    expect(_needsTokenRefresh({ status: 401, error: { message: 'x' } }, url, true)).toBeFalse();
  });

  it('no pide refresh para login, refresh, SESSION_REVOKED ni errores que no son 401', () => {
    const err = { status: 401, error: { message: 'TOKEN_EXPIRED' } };
    expect(_needsTokenRefresh(err, 'http://api/api/auth/login', false)).toBeFalse();
    expect(_needsTokenRefresh(err, 'http://api/api/auth/portal/login', false)).toBeFalse();
    expect(_needsTokenRefresh(err, 'http://api/api/auth/refresh', false)).toBeFalse();
    expect(
      _needsTokenRefresh(
        { status: 401, error: { code: 'SESSION_REVOKED' } },
        'http://api/api/credits',
        false,
      ),
    ).toBeFalse();
    expect(_needsTokenRefresh({ status: 0 }, 'http://api/api/credits', false)).toBeFalse();
  });

  it('reconoce los endpoints de login y refresh como formularios de auth', () => {
    expect(_isAuthFormRequest('http://api/api/auth/portal/login')).toBeTrue();
    expect(_isAuthFormRequest('http://api/api/auth/portal/refresh')).toBeTrue();
    expect(_isAuthFormRequest('http://api/api/auth/me')).toBeFalse();
  });
});

describe('_redirectToLogin', () => {
  let router: jasmine.SpyObj<Router>;
  let auth: jasmine.SpyObj<AuthServiceBase>;
  let notifSvc: jasmine.SpyObj<NotificationsService>;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    auth = jasmine.createSpyObj<AuthServiceBase>('AuthServiceBase', ['clearSession']);
    notifSvc = jasmine.createSpyObj<NotificationsService>('NotificationsService', ['stopPolling']);
  });

  it('corta el polling de unread-count antes de limpiar sesión y redirigir (no-portal)', () => {
    _redirectToLogin(router, auth, notifSvc, false);

    expect(notifSvc.stopPolling).toHaveBeenCalled();
    expect(auth.clearSession).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['login']);
  });

  it('en el flujo portal limpia la sesión del cliente en PortalAuthService', () => {
    const portalAuth = jasmine.createSpyObj<PortalAuthService>('PortalAuthService', [
      'clearSession',
    ]);

    _redirectToLogin(router, auth, notifSvc, true, undefined, portalAuth);

    expect(portalAuth.clearSession).toHaveBeenCalled();
  });

  it('no toca el polling ni clearSession en el flujo portal (token distinto)', () => {
    _redirectToLogin(router, auth, notifSvc, true);

    expect(notifSvc.stopPolling).not.toHaveBeenCalled();
    expect(auth.clearSession).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/portal/login']);
  });
});

describe('errorInterceptor — sesión del portal rechazada (#39)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'sgcf_portal_customer',
      JSON.stringify({ id: 'c-1', fullName: 'Ana', dni: '12345678', portalIsTempPassword: false }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        ...provideAuthTesting(null),
        { provide: NotificationsService, useValue: { stopPolling: () => undefined } },
      ],
    });
    spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
  });

  afterEach(() => localStorage.clear());

  const unauthorized = { status: 401, statusText: 'Unauthorized' };

  it('si el refresh del portal es rechazado, limpia al cliente y el guard de login no lo devuelve al dashboard (sin bucle)', () => {
    const http = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);
    const portalAuth = TestBed.inject(PortalAuthService);
    expect(portalAuth.isAuthenticated()).toBeTrue();

    http.get(`${environment.apiBaseUrl}/portal/me`).subscribe({ error: () => undefined });
    ctrl
      .expectOne(`${environment.apiBaseUrl}/portal/me`)
      .flush({ ok: false, message: 'x' }, unauthorized);
    ctrl
      .expectOne(`${environment.apiBaseUrl}/auth/portal/refresh`)
      .flush({ ok: false, code: 'SESSION_REVOKED', message: 'x' }, unauthorized);

    expect(portalAuth.isAuthenticated()).toBeFalse();
    const guardResult = TestBed.runInInjectionContext(() =>
      portalLoginGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    expect(guardResult).toBeTrue();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/portal/login']);
    ctrl.verify();
  });

  it('las requests encoladas fallan (no quedan colgadas) si el refresh falla', () => {
    const http = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);
    const errors: unknown[] = [];

    http.get(`${environment.apiBaseUrl}/portal/me`).subscribe({ error: (e) => errors.push(e) });
    http
      .get(`${environment.apiBaseUrl}/portal/credits`)
      .subscribe({ error: (e) => errors.push(e) });

    ctrl
      .expectOne(`${environment.apiBaseUrl}/portal/me`)
      .flush({ ok: false, message: 'x' }, unauthorized);
    ctrl
      .expectOne(`${environment.apiBaseUrl}/portal/credits`)
      .flush({ ok: false, message: 'x' }, unauthorized);
    ctrl
      .expectOne(`${environment.apiBaseUrl}/auth/portal/refresh`)
      .flush({ ok: false, code: 'SESSION_REVOKED', message: 'x' }, unauthorized);

    expect(errors.length).toBe(2);
    ctrl.verify();
  });
});

describe('errorInterceptor — sesión interna y refresh concurrente (#43)', () => {
  const API = environment.apiBaseUrl;
  const unauthorized = { status: 401, statusText: 'Unauthorized' };
  const expired = { ok: false, message: 'TOKEN_EXPIRED' };
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let router: Router;
  let auth: AuthService;
  let tokens: AccessTokenStore;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'sgcf_user',
      JSON.stringify({ id: 'u-1', full_name: 'Ana', dni: '1', roles: ['ADMIN'] }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        AuthService,
        { provide: AuthServiceBase, useExisting: AuthService },
        { provide: NotificationsService, useValue: { stopPolling: () => undefined } },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService);
    tokens = TestBed.inject(AccessTokenStore);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
  });

  afterEach(() => {
    ctrl.verify();
    localStorage.clear();
  });

  it('un 401 de una request sin token, con refresh rechazado, limpia la sesión y redirige a login', () => {
    expect(auth.isAuthenticated()).toBeTrue();
    let failed = false;
    http.get(`${API}/credits`).subscribe({ error: () => (failed = true) });

    const req = ctrl.expectOne(`${API}/credits`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({ ok: false, message: 'x' }, unauthorized);
    ctrl
      .expectOne(`${API}/auth/refresh`)
      .flush({ ok: false, code: 'SESSION_REVOKED', message: 'x' }, unauthorized);

    expect(failed).toBeTrue();
    expect(auth.isAuthenticated()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['login']);
  });

  it('dos requests con token vencido disparan un solo refresh y se reintentan sin bucle', () => {
    tokens.set(false, 'old.token');
    const results: unknown[] = [];
    http.get(`${API}/a`).subscribe((r) => results.push(r));
    http.get(`${API}/b`).subscribe((r) => results.push(r));

    ctrl.expectOne(`${API}/a`).flush(expired, unauthorized);
    ctrl.expectOne(`${API}/b`).flush(expired, unauthorized);
    ctrl.expectOne(`${API}/auth/refresh`).flush({ ok: true, data: { token: 'new.token' } });

    const retries = ctrl.match((r) => r.url === `${API}/a` || r.url === `${API}/b`);
    expect(retries.length).toBe(2);
    retries.forEach((r) => {
      expect(r.request.headers.get('Authorization')).toBe('Bearer new.token');
      r.flush({ ok: true });
    });

    expect(results.length).toBe(2);
    expect(tokens.get(false)).toBe('new.token');
    ctrl.expectNone(`${API}/auth/refresh`);
  });

  it('si el reintento falla con 403 no cierra la sesión: el error llega a quien llamó', () => {
    tokens.set(false, 'old.token');
    let status = 0;
    http.get(`${API}/a`).subscribe({ error: (e) => (status = e.status) });

    ctrl.expectOne(`${API}/a`).flush(expired, unauthorized);
    ctrl.expectOne(`${API}/auth/refresh`).flush({ ok: true, data: { token: 'new.token' } });
    ctrl
      .expectOne(`${API}/a`)
      .flush({ ok: false, message: 'sin permisos' }, { status: 403, statusText: 'Forbidden' });

    expect(status).toBe(403);
    expect(auth.isAuthenticated()).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalledWith(['login']);
  });

  it('logout con token vencido: la sesión queda cerrada y no se rehidrata el token', () => {
    tokens.set(false, 'old.token');
    auth.logout();
    expect(auth.isAuthenticated()).toBeFalse();

    ctrl.expectOne(`${API}/auth/logout`).flush(expired, unauthorized);
    ctrl.expectOne(`${API}/auth/refresh`).flush({ ok: true, data: { token: 'new.token' } });
    ctrl.expectOne(`${API}/auth/logout`).flush({ ok: true });

    expect(auth.isAuthenticated()).toBeFalse();
    expect(tokens.get(false)).toBeNull();
  });
});

describe('_shouldRedirectToChangePassword por código', () => {
  it('redirige con el código TEMP_PASSWORD_REQUIRED aunque cambie el texto', () => {
    expect(
      _shouldRedirectToChangePassword({
        status: 403,
        error: { code: 'TEMP_PASSWORD_REQUIRED', message: 'otro texto' },
      }),
    ).toBeTrue();
  });
});
