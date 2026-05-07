import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppRoutes } from '../../../shared/models/enums/routes.enum';
import { PortalAuthService } from './portal-auth.service';

/** Redirige a change-password si el cliente tiene contraseña temporal activa. */
export const portalTempPasswordGuard: CanActivateFn = () => {
  const auth = inject(PortalAuthService);
  const router = inject(Router);

  if (auth.snapshot?.portalIsTempPassword) {
    return router.createUrlTree([AppRoutes.PORTAL_CHANGE_PASSWORD]);
  }
  return true;
};
