import { _shouldRedirectToChangePassword } from './error.interceptor';

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
});
