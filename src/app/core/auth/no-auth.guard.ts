import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthServiceBase } from './auth-service.base';
import { Roles } from '../../shared/models/enums/roles.enum';

export const noAuthGuard: CanActivateFn = () => {
  const auth = inject(AuthServiceBase);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return true;

  const user = auth.snapshot!;
  if (user.roles.includes(Roles.ADMIN)) return router.createUrlTree(['/admin']);
  if (user.roles.includes(Roles.SELLER))
    return router.createUrlTree(['/seller']);
  if (user.roles.includes(Roles.COLLECTOR))
    return router.createUrlTree(['/collector']);
  if (user.roles.includes(Roles.SELLER_COLLECTOR))
    return router.createUrlTree(['/seller']);
  return router.createUrlTree(['/login']);
};
