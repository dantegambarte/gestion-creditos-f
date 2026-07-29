import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Router } from '@angular/router';
import { AuthService } from './auth.service';
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

    expect(localStorage.getItem('sgcf_token')).toBe('jwt.token.here');
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
        message:
          'Credenciales incorrectas. Verificá tus datos e intentá nuevamente.',
      },
      { status: 401, statusText: 'Unauthorized' },
    );
    tick();

    expect(errorMsg).toBe(
      'Credenciales incorrectas. Verificá tus datos e intentá nuevamente.',
    );
    expect(localStorage.getItem('sgcf_token')).toBeNull();
  }));

  // ── restoreSession con token válido ───────────────────────────────────────
  it('restoreSession: rehidrata usuario desde /me con token válido', fakeAsync(() => {
    localStorage.setItem('sgcf_token', 'existing.token');
    let emitted: AuthUser | null = null;
    service.currentUser$.subscribe((u) => (emitted = u));

    service.restoreSession().subscribe();

    const req = http.expectOne(`${API}/auth/me`);
    expect(req.request.headers.get('Authorization')).toBeNull(); // interceptor no activo en este test
    req.flush(mockMeResponse);
    tick();

    expect(emitted).not.toBeNull();
    expect(emitted!.id).toBe('u-1');
    expect(emitted!.roles).toEqual([Roles.ADMIN]);
  }));

  // ── restoreSession con token inválido (401) ───────────────────────────────
  it('restoreSession: limpia storage si /me retorna 401', fakeAsync(() => {
    localStorage.setItem('sgcf_token', 'expired.token');
    localStorage.setItem('sgcf_user', JSON.stringify({ id: 'u-1' }));
    let emitted: AuthUser | null | undefined = undefined;
    service.currentUser$.subscribe((u) => (emitted = u));

    service.restoreSession().subscribe();

    const req = http.expectOne(`${API}/auth/me`);
    req.flush(
      { ok: false, message: 'Token expirado.' },
      { status: 401, statusText: 'Unauthorized' },
    );
    tick();

    expect(emitted).toBeNull();
    expect(localStorage.getItem('sgcf_token')).toBeNull();
    expect(localStorage.getItem('sgcf_user')).toBeNull();
  }));

  // ── restoreSession sin token ──────────────────────────────────────────────
  it('restoreSession: no hace HTTP si no hay token', fakeAsync(() => {
    service.restoreSession().subscribe();
    tick();
    http.expectNone(`${API}/auth/me`);
  }));

  // ── Logout limpia storage aunque el POST falle ────────────────────────────
  it('logout: limpia storage y emite null incluso si POST /logout falla', fakeAsync(() => {
    // Simular sesión activa
    localStorage.setItem('sgcf_token', 'live.token');
    localStorage.setItem(
      'sgcf_user',
      JSON.stringify({ id: 'u-1', name: 'Test' }),
    );

    let emitted: AuthUser | null | undefined = undefined;
    service.currentUser$.subscribe((u) => (emitted = u));

    service.logout();

    // POST logout falla con 500
    const req = http.expectOne(`${API}/auth/logout`);
    req.flush(
      { ok: false, message: 'Error' },
      { status: 500, statusText: 'Server Error' },
    );
    tick();

    expect(localStorage.getItem('sgcf_token')).toBeNull();
    expect(localStorage.getItem('sgcf_user')).toBeNull();
    expect(emitted).toBeNull();
    expect(messageService.add).toHaveBeenCalledWith({
      severity: 'success',
      summary: 'Sesión cerrada',
    });
  }));
});
