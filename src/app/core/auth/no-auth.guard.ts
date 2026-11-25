import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthServiceBase } from './auth-service.base';
import { LOGIN_ROUTE, landingRouteForRoles } from './role-routes';

/**
 * Impide ver pantallas públicas a un usuario autenticado y lo manda a su ruta
 * de aterrizaje. Si su rol no tiene área propia, deja ver el login para evitar
 * un bucle de redirección contra la misma ruta.
 */
export const noAuthGuard: CanActivateFn = () => {
  const auth = inject(AuthServiceBase);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return true;

  const landing = landingRouteForRoles(auth.snapshot?.roles);
  if (landing === LOGIN_ROUTE) return true;
  return router.parseUrl(landing);
};
