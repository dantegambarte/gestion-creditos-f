import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AccessTokenStore } from '../auth/access-token.store';

/**
 * Adjunta el access token en memoria (interno o portal) y envía las cookies
 * (refresh token HttpOnly) en cada request al backend.
 */
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
  const token = inject(AccessTokenStore).get(isPortalUrl);

  const cloned = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      })
    : req.clone({ withCredentials: true });

  return next(cloned);
};
