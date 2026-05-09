import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthServiceBase } from './auth-service.base';
import { AppRoutes } from '../../shared/models/enums/routes.enum';

export const tempPasswordGuard: CanActivateFn = () => {
  const auth = inject(AuthServiceBase);
  const router = inject(Router);

  const user = auth.snapshot;
  if (user && user.is_temp_password) {
    return router.createUrlTree([AppRoutes.CHANGE_PASSWORD]);
  }
  return true;
};
