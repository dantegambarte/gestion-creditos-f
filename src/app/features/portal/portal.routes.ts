import { Routes } from '@angular/router';
import { portalAuthGuard } from './auth/portal-auth.guard';
import { portalLoginGuard } from './auth/portal-login.guard';

export const PORTAL_ROUTES: Routes = [
  {
    path: 'login',
    canActivate: [portalLoginGuard],
    loadComponent: () =>
      import('./login/portal-login.component').then(
        (c) => c.PortalLoginComponent,
      ),
  },
  {
    path: '',
    canActivate: [portalAuthGuard],
    loadComponent: () =>
      import('./layout/portal-layout.component').then(
        (c) => c.PortalLayoutComponent,
      ),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/portal-dashboard.component').then(
            (c) => c.PortalDashboardComponent,
          ),
      },
      {
        path: 'credits',
        loadComponent: () =>
          import('./credits/portal-credits.component').then(
            (c) => c.PortalCreditsComponent,
          ),
      },
      {
        path: 'credits/:id',
        loadComponent: () =>
          import('./credits/detail/portal-credit-detail.component').then(
            (c) => c.PortalCreditDetailComponent,
          ),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];
