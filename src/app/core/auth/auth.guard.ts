import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthServiceBase } from './auth-service.base';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthServiceBase);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;
  router.navigate(['/login']);
  return false;
};
