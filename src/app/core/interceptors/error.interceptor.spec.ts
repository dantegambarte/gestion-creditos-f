import {
  _httpErrorSummary,
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
    expect(_httpErrorSummary(403)).toBe(
      'No tienes permisos para esta acción',
    );
    expect(_httpErrorSummary(500)).toBe('Error interno del servidor');
    expect(_httpErrorSummary(503)).toBe('Error interno del servidor');
  });

  it('no muestra toast global para errores de dominio que debe manejar la pantalla', () => {
    expect(_httpErrorSummary(400)).toBeNull();
    expect(_httpErrorSummary(404)).toBeNull();
    expect(_httpErrorSummary(undefined)).toBeNull();
  });
});
