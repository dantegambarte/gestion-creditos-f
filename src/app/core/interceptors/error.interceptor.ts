import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, throwError, switchMap, filter, take, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppRoutes } from '../../shared/models/enums/routes.enum';
import { MockAuthService } from '../auth/mock-auth.service';
import { TokenRefreshService } from '../auth/token-refresh.service';

// Estado de refresh a nivel de módulo para serializar llamadas concurrentes.
// Si dos requests reciben TOKEN_EXPIRED al mismo tiempo, solo se hace un refresh.
let isRefreshing = false;
const tokenSubject = new BehaviorSubject<string | null>(null);

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router       = inject(Router);
  const auth         = inject(MockAuthService);
  const tokenRefresh = inject(TokenRefreshService);

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
        if (!isRefreshing) {
          isRefreshing = true;
          tokenSubject.next(null);

          const refresh$ = isPortal
            ? tokenRefresh.refreshPortal()
            : tokenRefresh.refreshInternal();

          return refresh$.pipe(
            switchMap((newToken) => {
              isRefreshing = false;
              tokenSubject.next(newToken);
              const tokenKey = isPortal ? environment.portalTokenKey : environment.tokenKey;
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem(tokenKey, newToken);
              }
              return next(
                req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }),
              );
            }),
            catchError((refreshErr) => {
              isRefreshing = false;
              tokenSubject.next(null);
              _redirectToLogin(router, auth, isPortal);
              return throwError(() => refreshErr);
            }),
          );
        } else {
          // Refresh en curso — encolar y reintentar con el nuevo token cuando llegue
          return tokenSubject.pipe(
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

      if (err?.status === 403) {
        router.navigate([AppRoutes.CHANGE_PASSWORD]);
      }

      return throwError(() => err);
    }),
  );
};

function _redirectToLogin(router: Router, auth: MockAuthService, isPortal: boolean): void {
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
