import { Router } from '@angular/router';
import { AuthServiceBase } from '../auth/auth-service.base';
import { NotificationsService } from '../services/notifications.service';
import {
  _httpErrorSummary,
  _isAuthFormRequest,
  _isInternalSessionAlreadyClosed,
  _needsTokenRefresh,
  _redirectToLogin,
  _shouldRedirectToChangePassword,
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

  it('no toca el polling ni clearSession en el flujo portal (token distinto)', () => {
    _redirectToLogin(router, auth, notifSvc, true);

    expect(notifSvc.stopPolling).not.toHaveBeenCalled();
    expect(auth.clearSession).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/portal/login']);
  });
});
