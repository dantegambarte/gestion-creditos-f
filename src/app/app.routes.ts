import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { noAuthGuard } from './core/auth/no-auth.guard';
import { tempPasswordGuard } from './core/auth/temp-password.guard';
import { Roles } from './shared/models/enums/roles.enum';
import { AppRoutes } from './shared/models/enums/routes.enum';

export const routes: Routes = [
  {
    path: AppRoutes.LOGIN,
    canActivate: [noAuthGuard],
    loadChildren: () =>
      import('./features/public/login/login.routes').then(
        (r) => r.LOGIN_ROUTES,
      ),
  },
  {
    path: AppRoutes.CHANGE_PASSWORD,
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/public/change-password/change-password.component').then(
        (c) => c.ChangePasswordComponent,
      ),
  },
  {
    path: AppRoutes.ADMIN,
    canActivate: [authGuard, tempPasswordGuard, roleGuard],
    data: { roles: [Roles.ADMIN] },
    loadChildren: () =>
      import('./features/admin/admin.routes').then((r) => r.ADMIN_ROUTES),
  },
  {
    path: AppRoutes.SELLER,
    canActivate: [authGuard, tempPasswordGuard, roleGuard],
    data: {
      roles: [
        Roles.SELLER,
        Roles.ADMIN,
        Roles.COLLECTOR,
        Roles.SELLER_COLLECTOR,
      ],
    },
    loadChildren: () =>
      import('./features/seller/seller.routes').then((r) => r.SELLER_ROUTES),
  },
  {
    path: AppRoutes.COLLECTOR,
    canActivate: [authGuard, tempPasswordGuard, roleGuard],
    data: { roles: [Roles.COLLECTOR, Roles.SELLER_COLLECTOR] },
    loadChildren: () =>
      import('./features/collector/collector.routes').then(
        (r) => r.COLLECTOR_ROUTES,
      ),
  },
  {
    path: AppRoutes.FORGOT_PASSWORD,
    loadComponent: () =>
      import('./features/public/forgot-password/forgot-password.component').then(
        (c) => c.ForgotPasswordComponent,
      ),
  },
  {
    path: AppRoutes.PORTAL,
    loadChildren: () =>
      import('./features/portal/portal.routes').then((r) => r.PORTAL_ROUTES),
  },
  {
    path: AppRoutes.PROFILE,
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile.component').then(
        (c) => c.ProfileComponent,
      ),
  },
  { path: '', redirectTo: AppRoutes.LOGIN, pathMatch: 'full' },
  { path: '**', redirectTo: AppRoutes.LOGIN },
];
