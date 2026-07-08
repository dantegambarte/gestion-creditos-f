import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  if (req.url.includes('/credits/simulate')) {
    return next(req);
  }

  // Detecta endpoints del portal del cliente buscando "/portal/" como segmento.
  // No usar includes('portal') porque hace match con acciones admin como
  // customers/{id}/enable-portal y rompe el token / redirige a /portal/login.
  const isPortalUrl = req.url.includes('/portal/');
  const tokenKey = isPortalUrl
    ? environment.portalTokenKey
    : environment.tokenKey;
  const token = readStoredToken(tokenKey);

  const cloned = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      })
    : req.clone({ withCredentials: true });

  return next(cloned);
};

/**
 * Lee el token JWT desde storage sólo cuando la app corre en browser.
 * @param tokenKey - Clave usada para token interno o token del portal.
 */
function readStoredToken(tokenKey: string): string | null {
  return typeof localStorage !== 'undefined'
    ? localStorage.getItem(tokenKey)
    : null;
}
