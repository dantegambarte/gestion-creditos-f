import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AppRoutes } from '../../../shared/models/enums/routes.enum';
import { PortalAuthService } from './portal-auth.service';

export const portalAuthGuard: CanActivateFn = () => {
  // En SSR no hay localStorage, el guard se evalúa en el cliente
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

  const auth = inject(PortalAuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;
  return router.createUrlTree([AppRoutes.PORTAL_LOGIN]);
};
