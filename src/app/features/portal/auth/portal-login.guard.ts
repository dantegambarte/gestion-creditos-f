import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppRoutes } from '../../../shared/models/enums/routes.enum';
import { PortalAuthService } from './portal-auth.service';

export const portalLoginGuard: CanActivateFn = () => {
  const auth = inject(PortalAuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return true;
  return router.createUrlTree([AppRoutes.PORTAL_DASHBOARD]);
};
