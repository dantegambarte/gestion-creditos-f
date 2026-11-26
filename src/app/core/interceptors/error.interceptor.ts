import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { throwError, switchMap, filter, take, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppRoutes } from '../../shared/models/enums/routes.enum';
import { AuthServiceBase } from '../auth/auth-service.base';
import { TokenRefreshService } from '../auth/token-refresh.service';
import { TokenRefreshStateService } from '../auth/token-refresh-state.service';
import { AccessTokenStore, isSessionRejected } from '../auth/access-token.store';
import { NotificationsService } from '../services/notifications.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthServiceBase);
  const tokenRefresh = inject(TokenRefreshService);
  const refreshState = inject(TokenRefreshStateService);
  const messageService = inject(MessageService);
  const notifSvc = inject(NotificationsService);
  const tokens = inject(AccessTokenStore);

  return next(req).pipe(
    catchError((err) => {
      if (!req.url.startsWith(environment.apiBaseUrl)) {
        return throwError(() => err);
      }

      // Detecta endpoints del portal del cliente buscando "/portal/" como segmento.
      // No usar includes('portal') porque hace match con acciones admin como
      // customers/{id}/enable-portal y dispara redirect a /portal/login.
      const isPortal = req.url.includes('/portal/');
      const isRefreshUrl = req.url.includes('/refresh');
      const isTokenExpired = _needsTokenRefresh(err, req.url, req.headers.has('Authorization'));

      // Token expirado → refresh automático + reintento de la request original
      if (isTokenExpired && !isRefreshUrl) {
        if (!refreshState.isRefreshing) {
          refreshState.isRefreshing = true;
          refreshState.tokenSubject.next(null);

          const refresh$ = isPortal ? tokenRefresh.refreshPortal() : tokenRefresh.refreshInternal();

          return refresh$.pipe(
            switchMap((newToken) => {
              refreshState.isRefreshing = false;
              refreshState.tokenSubject.next(newToken);
              tokens.set(isPortal, newToken);
              return next(
                req.clone({
                  setHeaders: { Authorization: `Bearer ${newToken}` },
                }),
              );
            }),
            catchError((refreshErr) => {
              refreshState.isRefreshing = false;
              refreshState.tokenSubject.next(null);
              _showGlobalHttpError(messageService, refreshErr);
              // Un corte de red o un 5xx no cierra la sesión: sólo el rechazo del backend.
              if (isSessionRejected(refreshErr)) {
                _redirectToLogin(router, auth, notifSvc, isPortal, tokens);
              }
              return throwError(() => refreshErr);
            }),
          );
        } else {
          // Refresh en curso — encolar y reintentar con el nuevo token cuando llegue
          return refreshState.tokenSubject.pipe(
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

      if (
        err?.status === 401 &&
        !_isAuthFormRequest(req.url) &&
        !_isInternalSessionAlreadyClosed(isPortal, auth.isAuthenticated())
      ) {
        _showGlobalHttpError(messageService, err);
        _redirectToLogin(router, auth, notifSvc, isPortal, tokens);
      }

      if (err?.status !== 401) {
        _showGlobalHttpError(messageService, err);
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

/**
 * Publica un toast global para errores HTTP transversales de infraestructura.
 * @param messageService - Canal global de mensajes PrimeNG.
 * @param err - Error HTTP capturado por el interceptor.
 */
function _showGlobalHttpError(messageService: MessageService, err: unknown): void {
  const status = err instanceof HttpErrorResponse ? err.status : undefined;
  const summary = _httpErrorSummary(status);

  if (!summary) {
    return;
  }

  messageService.add({
    severity: status === 0 || (status ?? 0) >= 500 ? 'error' : 'warn',
    summary,
  });
}

/**
 * Traduce códigos HTTP globales a mensajes estandarizados de usuario.
 * @param status - Código HTTP devuelto por Angular HttpClient.
 */
export function _httpErrorSummary(status: number | undefined): string | null {
  if (status === 0) return 'Error de red o servidor inalcanzable';
  if (status === 401) return 'Sesión expirada';
  if (status === 403) return 'No tienes permisos para esta acción';
  if (status && status >= 500) return 'Error interno del servidor';
  return null;
}

/**
 * Detecta 401 tardíos disparados después de un logout manual ya aplicado.
 * @param isPortal Indica si la request pertenece al portal cliente.
 * @param hasInternalSession Indica si todavía hay un usuario interno autenticado.
 */
export function _isInternalSessionAlreadyClosed(
  isPortal: boolean,
  hasInternalSession: boolean,
): boolean {
  if (isPortal) return false;
  return !hasInternalSession;
}

/**
 * Indica si la request es un login o un refresh, cuyos 401 los maneja
 * quien la llamó (credenciales inválidas, bloqueo) y no deben redirigir.
 * @param url URL de la request.
 */
export function _isAuthFormRequest(url: string): boolean {
  return /\/auth\/(portal\/)?(login|refresh)$/.test(url);
}

/**
 * Decide si un error amerita renovar el access token con el refresh token:
 * token vencido (TOKEN_EXPIRED) o 401 de una request que salió sin token
 * porque el access token en memoria todavía no se recuperó tras recargar.
 * @param err Error HTTP.
 * @param url URL de la request.
 * @param hadToken true si la request llevaba header Authorization.
 */
export function _needsTokenRefresh(err: unknown, url: string, hadToken: boolean): boolean {
  const e = err as { status?: number; error?: { message?: unknown; code?: unknown } } | null;
  if (e?.status !== 401 || _isAuthFormRequest(url)) return false;
  if (e.error?.code === 'SESSION_REVOKED') return false;
  return e.error?.message === 'TOKEN_EXPIRED' || !hadToken;
}

/**
 * Cierra la sesión local (interna o del portal) y navega al login correspondiente.
 * @param tokens Almacén en memoria de access tokens; se descarta el del contexto.
 */
export function _redirectToLogin(
  router: Router,
  auth: AuthServiceBase,
  notifSvc: NotificationsService,
  isPortal: boolean,
  tokens?: AccessTokenStore,
): void {
  if (isPortal) {
    tokens?.set(true, null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(environment.portalTokenKey);
      localStorage.removeItem('sgcf_portal_customer');
    }
    router.navigate([AppRoutes.PORTAL_LOGIN]);
  } else {
    notifSvc.stopPolling();
    auth.clearSession();
    router.navigate([AppRoutes.LOGIN]);
  }
}
