import { Router } from '@angular/router';
import { AuthServiceBase } from '../auth/auth-service.base';
import { NotificationsService } from '../services/notifications.service';
import {
  _httpErrorSummary,
  _isInternalSessionAlreadyClosed,
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

  it('detecta 401 tardíos internos cuando el logout ya limpió el token', () => {
    localStorage.removeItem('sgcf_token');

    expect(_isInternalSessionAlreadyClosed(false)).toBeTrue();
    expect(_isInternalSessionAlreadyClosed(true)).toBeFalse();
  });

  it('mantiene 401 internos como sesión activa cuando todavía existe token', () => {
    localStorage.setItem('sgcf_token', 'live.token');

    expect(_isInternalSessionAlreadyClosed(false)).toBeFalse();
  });
});

describe('_redirectToLogin', () => {
  let router: jasmine.SpyObj<Router>;
  let auth: jasmine.SpyObj<AuthServiceBase>;
  let notifSvc: jasmine.SpyObj<NotificationsService>;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    auth = jasmine.createSpyObj<AuthServiceBase>('AuthServiceBase', [
      'clearSession',
    ]);
    notifSvc = jasmine.createSpyObj<NotificationsService>(
      'NotificationsService',
      ['stopPolling'],
    );
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
