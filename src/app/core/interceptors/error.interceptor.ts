import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { throwError, switchMap, filter, take, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppRoutes } from '../../shared/models/enums/routes.enum';
import { AuthServiceBase } from '../auth/auth-service.base';
import { TokenRefreshService } from '../auth/token-refresh.service';
import { TokenRefreshStateService } from '../auth/token-refresh-state.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router        = inject(Router);
  const auth          = inject(AuthServiceBase);
  const tokenRefresh  = inject(TokenRefreshService);
  const refreshState  = inject(TokenRefreshStateService);

  return next(req).pipe(
    catchError((err) => {
      if (!req.url.startsWith(environment.apiBaseUrl)) {
        return throwError(() => err);
      }

      const isTokenExpired = err?.status === 401 && err?.error?.message === 'TOKEN_EXPIRED';
      const isRefreshUrl   = req.url.includes('/auth/refresh');
      const isPortal       = req.url.includes(AppRoutes.PORTAL);

      // Token expirado → refresh automático + reintento de la request original
      if (isTokenExpired && !isRefreshUrl) {
        if (!refreshState.isRefreshing) {
          refreshState.isRefreshing = true;
          refreshState.tokenSubject.next(null);

          const refresh$ = isPortal
            ? tokenRefresh.refreshPortal()
            : tokenRefresh.refreshInternal();

          return refresh$.pipe(
            switchMap((newToken) => {
              refreshState.isRefreshing = false;
              refreshState.tokenSubject.next(newToken);
              const tokenKey = isPortal ? environment.portalTokenKey : environment.tokenKey;
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem(tokenKey, newToken);
              }
              return next(
                req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }),
              );
            }),
            catchError((refreshErr) => {
              refreshState.isRefreshing = false;
              refreshState.tokenSubject.next(null);
              _redirectToLogin(router, auth, isPortal);
              return throwError(() => refreshErr);
            }),
          );
        } else {
          // Refresh en curso — encolar y reintentar con el nuevo token cuando llegue
          return refreshState.tokenSubject.pipe(
            filter((t): t is string => t !== null),
            take(1),
            switchMap((newToken) =>
              next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })),
            ),
          );
        }
      }

      if (err?.status === 401) {
        _redirectToLogin(router, auth, isPortal);
      }

      if (_shouldRedirectToChangePassword(err)) {
        // Redirigir solo cuando el backend indica explícitamente "contraseña temporal".
        router.navigate([isPortal ? AppRoutes.PORTAL_CHANGE_PASSWORD : AppRoutes.CHANGE_PASSWORD]);
      }

      return throwError(() => err);
    }),
  );
};

/**
 * Determina si un 403 corresponde al caso de contraseña temporal obligatoria.
 * @param {unknown} err Error HTTP devuelto por el backend.
 * @returns {boolean} true solo si el 403 contiene el mensaje esperado de cambio obligatorio.
 */
export function _shouldRedirectToChangePassword(err: unknown): boolean {
  const message = (err as { error?: { message?: unknown } })?.error?.message;
  return (
    (err as { status?: number })?.status === 403 &&
    typeof message === 'string' &&
    message.includes('Debés cambiar tu contraseña antes de continuar.')
  );
}

function _redirectToLogin(router: Router, auth: AuthServiceBase, isPortal: boolean): void {
  if (isPortal) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(environment.portalTokenKey);
      localStorage.removeItem('sgcf_portal_customer');
    }
    router.navigate([AppRoutes.PORTAL_LOGIN]);
  } else {
    auth.clearSession();
    router.navigate([AppRoutes.LOGIN]);
  }
}
