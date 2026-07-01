import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthServiceBase } from './auth-service.base';
import { UserRole } from '../models/types/user-role';
import { AppRoutes } from '../../shared/models/enums/routes.enum';

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
 * Resuelve una ruta segura de fallback según el rol actual del usuario.
 * @param roles - Roles del usuario autenticado, si están disponibles.
 */
export function defaultRouteForUser(roles: UserRole[] | undefined): string {
  if (roles?.includes('ADMIN')) return `/${AppRoutes.ADMIN}/${AppRoutes.DASHBOARD}`;
  if (roles?.includes('SELLER') || roles?.includes('SELLER_COLLECTOR')) {
    return `/${AppRoutes.SELLER}/${AppRoutes.OPERATIONS}`;
  }
  if (roles?.includes('COLLECTOR')) return AppRoutes.ROUTE;
  return `/${AppRoutes.LOGIN}`;
}
