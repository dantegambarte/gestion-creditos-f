import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AccessTokenStore } from './access-token.store';
import { AuthUser } from '../models/interface/auth-user';
import { Roles } from '../../shared/models/enums/roles.enum';
import { environment } from '../../../environments/environment';
import { MessageService } from 'primeng/api';

// Base tomada del environment activo en tests (relativa: '/api'), no hardcodeada,
// para que el spec siga a la app si cambia la baseURL.
const API = environment.apiBaseUrl;

const mockLoginResponse = {
  ok: true,
  message: 'Inicio de sesión exitoso.',
  data: {
    token: 'jwt.token.here',
    user: {
      id: 'u-1',
      full_name: 'Carlos López',
      dni: '12345678',
      role: Roles.ADMIN,
      is_temp_password: false,
    },
  },
};

const mockMeResponse = {
  ok: true,
  message: '',
  data: {
    id: 'u-1',
    full_name: 'Carlos López',
    dni: '12345678',
    role: Roles.ADMIN,
    status: 'ACTIVE',
    is_temp_password: false,
    force_relogin_at: null,
  },
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let router: Router;
  let messageService: MessageService;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        MessageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    messageService = TestBed.inject(MessageService);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    spyOn(messageService, 'add');
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  // ── Login happy path ──────────────────────────────────────────────────────
  it('login: almacena token y emite AuthUser al currentUser$', fakeAsync(() => {
    let emitted: AuthUser | null = null;
    service.currentUser$.subscribe((u) => (emitted = u));

    service.login({ dni: '12345678', password: 'pass123' }).subscribe();

    const req = http.expectOne(`${API}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ dni: '12345678', password: 'pass123' });
    req.flush(mockLoginResponse);
    tick();

    // #39: el token vive sólo en memoria, nunca en storage.
    expect(localStorage.getItem('sgcf_token')).toBeNull();
    expect(sessionStorage.getItem('sgcf_token')).toBeNull();
    expect(localStorage.getItem('sgcf_user')).not.toContain('jwt.token.here');
    expect(service.token).toBe('jwt.token.here');
    expect(emitted).not.toBeNull();
    expect(emitted!.full_name).toBe('Carlos López');
    expect(emitted!.name).toBe('Carlos López'); // alias compat
    expect(emitted!.roles).toEqual([Roles.ADMIN]); // role singular → array
    expect(emitted!.avatar).toBe('CL'); // iniciales calculadas
    expect(emitted!.is_temp_password).toBeFalse();
  }));

  // ── Login 401: mensaje del backend propagado ──────────────────────────────
  it('login: propaga el mensaje exacto del backend en error 401', fakeAsync(() => {
    let errorMsg = '';
    service
      .login({ dni: '00000000', password: 'wrong' })
      .subscribe({ error: (e) => (errorMsg = e.message) });

    const req = http.expectOne(`${API}/auth/login`);
    req.flush(
      {
        ok: false,
        message: 'Credenciales incorrectas. Verificá tus datos e intentá nuevamente.',
      },
      { status: 401, statusText: 'Unauthorized' },
    );
    tick();

    expect(errorMsg).toBe('Credenciales incorrectas. Verificá tus datos e intentá nuevamente.');
    expect(localStorage.getItem('sgcf_token')).toBeNull();
  }));

  /**
   * Recrea el servicio después de sembrar un perfil guardado, como al recargar la página.
   * @param legacyToken - token que versiones anteriores dejaban en localStorage
   */
  function reloadWithStoredUser(legacyToken?: string): void {
    localStorage.setItem(
      'sgcf_user',
      JSON.stringify({ id: 'u-1', full_name: 'Carlos López', roles: [Roles.ADMIN] }),
    );
    if (legacyToken) localStorage.setItem('sgcf_token', legacyToken);
    // El servicio ya se creó en beforeEach: se fuerza un nuevo injector.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        MessageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  }

  // ── restoreSession al recargar: refresh + /me ─────────────────────────────
  it('restoreSession: al recargar renueva el token con la cookie y rehidrata desde /me', fakeAsync(() => {
    reloadWithStoredUser('legacy.token');
    let emitted: AuthUser | null = null;
    service.currentUser$.subscribe((u) => (emitted = u));

    service.restoreSession().subscribe();
    // El token heredado de versiones anteriores se borra de localStorage.
    expect(localStorage.getItem('sgcf_token')).toBeNull();

    const refresh = http.expectOne(`${API}/auth/refresh`);
    expect(refresh.request.method).toBe('POST');
    expect(refresh.request.withCredentials).toBeTrue();
    refresh.flush({ ok: true, data: { token: 'fresh.token' } });

    http.expectOne(`${API}/auth/me`).flush(mockMeResponse);
    tick();

    expect(emitted!.id).toBe('u-1');
    expect(emitted!.roles).toEqual([Roles.ADMIN]);
    expect(service.token).toBe('fresh.token');
    expect(localStorage.getItem('sgcf_token')).toBeNull();
    expect(localStorage.getItem('sgcf_user')).not.toContain('fresh.token');
  }));

  it('restoreSession: reintenta una vez si otra pestaña ya rotó el refresh token', fakeAsync(() => {
    reloadWithStoredUser();
    service.restoreSession().subscribe();

    http
      .expectOne(`${API}/auth/refresh`)
      .flush(
        { ok: false, code: 'REFRESH_TOKEN_ROTATED', message: 'rotado' },
        { status: 401, statusText: 'Unauthorized' },
      );
    tick();
    http.expectOne(`${API}/auth/refresh`).flush({ ok: true, data: { token: 'winner.token' } });
    http.expectOne(`${API}/auth/me`).flush(mockMeResponse);
    tick();

    expect(service.token).toBe('winner.token');
    expect(service.isAuthenticated()).toBeTrue();
  }));

  // ── restoreSession con sesión rechazada (401) ─────────────────────────────
  it('restoreSession: limpia la sesión si el refresh retorna 401', fakeAsync(() => {
    reloadWithStoredUser();
    let emitted: AuthUser | null | undefined = undefined;
    service.currentUser$.subscribe((u) => (emitted = u));

    service.restoreSession().subscribe();

    http
      .expectOne(`${API}/auth/refresh`)
      .flush(
        { ok: false, code: 'SESSION_REVOKED', message: 'Sesión revocada.' },
        { status: 401, statusText: 'Unauthorized' },
      );
    tick();

    expect(emitted).toBeNull();
    expect(localStorage.getItem('sgcf_user')).toBeNull();
  }));

  it('restoreSession: un 401 del refresh interno no borra la sesión del portal (cookie compartida)', fakeAsync(() => {
    reloadWithStoredUser();
    const portalCustomer = JSON.stringify({ id: 'c-1', fullName: 'Ana' });
    localStorage.setItem('sgcf_portal_customer', portalCustomer);
    TestBed.inject(AccessTokenStore).set(true, 'portal.token');

    service.restoreSession().subscribe();
    http
      .expectOne(`${API}/auth/refresh`)
      .flush(
        { ok: false, code: 'SESSION_REVOKED', message: 'x' },
        { status: 401, statusText: 'Unauthorized' },
      );
    tick();

    expect(service.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem('sgcf_portal_customer')).toBe(portalCustomer);
    expect(TestBed.inject(AccessTokenStore).get(true)).toBe('portal.token');
  }));

  // ── restoreSession sin red: no expulsa al usuario ─────────────────────────
  it('restoreSession: conserva la sesión si el refresh falla por red (status 0)', fakeAsync(() => {
    reloadWithStoredUser();

    service.restoreSession().subscribe();

    http.expectOne(`${API}/auth/refresh`).error(new ProgressEvent('error'), { status: 0 });
    tick();

    expect(service.isAuthenticated()).toBeTrue();
    expect(localStorage.getItem('sgcf_user')).not.toBeNull();
  }));

  it('restoreSession: conserva la sesión si /me responde 503', fakeAsync(() => {
    reloadWithStoredUser();

    service.restoreSession().subscribe();

    http.expectOne(`${API}/auth/refresh`).flush({ ok: true, data: { token: 'fresh.token' } });
    http
      .expectOne(`${API}/auth/me`)
      .flush({ ok: false, message: 'down' }, { status: 503, statusText: 'Unavailable' });
    tick();

    expect(service.isAuthenticated()).toBeTrue();
  }));

  // ── restoreSession sin sesión previa ──────────────────────────────────────
  it('restoreSession: no hace HTTP si no hay sesión guardada', fakeAsync(() => {
    service.restoreSession().subscribe();
    tick();
    http.expectNone(`${API}/auth/refresh`);
    http.expectNone(`${API}/auth/me`);
  }));

  // ── Logout limpia storage aunque el POST falle ────────────────────────────
  it('logout: limpia storage y emite null incluso si POST /logout falla', fakeAsync(() => {
    // Simular sesión activa
    localStorage.setItem('sgcf_token', 'live.token');
    localStorage.setItem('sgcf_user', JSON.stringify({ id: 'u-1', name: 'Test' }));

    let emitted: AuthUser | null | undefined = undefined;
    service.currentUser$.subscribe((u) => (emitted = u));

    service.logout();

    // POST logout falla con 500
    const req = http.expectOne(`${API}/auth/logout`);
    req.flush({ ok: false, message: 'Error' }, { status: 500, statusText: 'Server Error' });
    tick();

    expect(localStorage.getItem('sgcf_token')).toBeNull();
    expect(localStorage.getItem('sgcf_user')).toBeNull();
    expect(emitted).toBeNull();
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'warn', summary: 'Cierre parcial' }),
    );
    expect(messageService.add).toHaveBeenCalledWith({
      severity: 'success',
      summary: 'Sesión cerrada',
    });
  }));
});
