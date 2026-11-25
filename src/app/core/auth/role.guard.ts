import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthServiceBase } from './auth-service.base';
import { UserRole } from '../models/types/user-role';
import { landingRouteForRoles } from './role-routes';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthServiceBase);
  const router = inject(Router);
  const messageService = inject(MessageService);
  const roles = route.data['roles'] as UserRole[] | undefined;

  if (!roles?.length || auth.hasAnyRole(roles)) return true;

  messageService.add({
    severity: 'warn',
    summary: 'Acceso denegado: Privilegios insuficientes',
  });
  router.navigate([defaultRouteForUser(auth.snapshot?.roles)]);
  return false;
};

/**
 * Resuelve una ruta segura y absoluta de fallback según el rol actual del
 * usuario, delegando en el mapeo único rol→ruta.
 * @param roles - Roles del usuario autenticado, si están disponibles.
 */
export function defaultRouteForUser(roles: UserRole[] | undefined): string {
  return landingRouteForRoles(roles);
}
