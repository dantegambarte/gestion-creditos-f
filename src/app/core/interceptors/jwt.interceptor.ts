import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
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

  const token =
    typeof localStorage !== 'undefined' ? localStorage.getItem(tokenKey) : null;

  // withCredentials envía la cookie HttpOnly rt en todas las requests a la API
  const cloned = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      })
    : req.clone({ withCredentials: true });

  return next(cloned);
};
