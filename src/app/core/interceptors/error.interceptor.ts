import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import {
  BehaviorSubject,
  catchError,
  filter,
  switchMap,
  take,
  throwError,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppRoutes } from '../../shared/models/enums/routes.enum';
import { AuthServiceBase } from '../auth/auth-service.base';
import { TokenRefreshService } from '../auth/token-refresh.service';

// Estado de refresh a nivel de módulo para serializar llamadas concurrentes.
// Si dos requests reciben TOKEN_EXPIRED al mismo tiempo, solo se hace un refresh.
let isRefreshing = false;
const tokenSubject = new BehaviorSubject<string | null>(null);

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthServiceBase);
  const tokenRefresh = inject(TokenRefreshService);
  const messages = inject(MessageService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (!req.url.startsWith(environment.apiBaseUrl)) {
        return throwError(() => err);
      }

      const isTokenExpired =
        err?.status === 401 && err?.error?.message === 'TOKEN_EXPIRED';
      const isRefreshUrl = req.url.includes('/auth/refresh');
      const isPortal = req.url.includes(AppRoutes.PORTAL);

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
              const tokenKey = isPortal
                ? environment.portalTokenKey
                : environment.tokenKey;
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem(tokenKey, newToken);
              }
              return next(
                req.clone({
                  setHeaders: { Authorization: `Bearer ${newToken}` },
                }),
              );
            }),
            catchError((refreshErr) => {
              isRefreshing = false;
              tokenSubject.next(null);
              _redirectToLogin(router, auth, messages, isPortal);
              return throwError(() => refreshErr);
            }),
          );
        } else {
          // Refresh en curso — encolar y reintentar con el nuevo token cuando llegue
          return tokenSubject.pipe(
            filter((t): t is string => t !== null),
            take(1),
            switchMap((newToken) =>
              next(
                req.clone({
                  setHeaders: { Authorization: `Bearer ${newToken}` },
                }),
              ),
            ),
          );
        }
      }

      _handleHttpError(err, router, auth, messages, isPortal);

      return throwError(() => err);
    }),
  );
};

/**
 * Maneja errores HTTP globalmente según el status code.
 * Muestra toasts y redirige cuando corresponde.
 */
function _handleHttpError(
  err: HttpErrorResponse,
  router: Router,
  auth: AuthServiceBase,
  messages: MessageService,
  isPortal: boolean,
): void {
  switch (err.status) {
    case 400: {
      const detail =
        err.error?.message ?? 'La solicitud contiene datos inválidos.';
      messages.add({ severity: 'error', summary: 'Error', detail });
      break;
    }
    case 401:
      messages.add({
        severity: 'warn',
        summary: 'Sesión expirada',
        detail: 'Tu sesión expiró. Ingresá nuevamente.',
      });
      _redirectToLogin(router, auth, messages, isPortal);
      break;
    case 403:
      messages.add({
        severity: 'warn',
        summary: 'Acceso denegado',
        detail: 'No tenés permisos para realizar esta acción.',
      });
      // Regla de negocio: 403 redirige a cambio de contraseña (contraseña temporal)
      router.navigate([AppRoutes.CHANGE_PASSWORD]);
      break;
    case 404:
      messages.add({
        severity: 'warn',
        summary: 'No encontrado',
        detail: 'El recurso solicitado no existe.',
      });
      break;
    case 500:
      messages.add({
        severity: 'error',
        summary: 'Error del servidor',
        detail: 'Ocurrió un error interno. Intentá de nuevo en unos minutos.',
      });
      break;
    default:
      messages.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Ocurrió un error inesperado. Intentá de nuevo.',
      });
      break;
  }
}

/**
 * Limpia la sesión y redirige al login correspondiente según el contexto (portal o admin).
 */
function _redirectToLogin(
  router: Router,
  auth: AuthServiceBase,
  messages: MessageService,
  isPortal: boolean,
): void {
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
