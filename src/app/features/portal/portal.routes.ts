import { Routes } from '@angular/router';
import { portalAuthGuard } from './auth/portal-auth.guard';
import { portalLoginGuard } from './auth/portal-login.guard';
import { portalTempPasswordGuard } from './auth/portal-temp-password.guard';

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
        path: 'change-password',
        loadComponent: () =>
          import('./change-password/portal-change-password.component').then(
            (c) => c.PortalChangePasswordComponent,
          ),
      },
      {
        path: 'dashboard',
        canActivate: [portalTempPasswordGuard],
        loadComponent: () =>
          import('./dashboard/portal-dashboard.component').then(
            (c) => c.PortalDashboardComponent,
          ),
      },
      {
        path: 'credits',
        canActivate: [portalTempPasswordGuard],
        loadComponent: () =>
          import('./credits/portal-credits.component').then(
            (c) => c.PortalCreditsComponent,
          ),
      },
      {
        path: 'credits/:id',
        canActivate: [portalTempPasswordGuard],
        loadComponent: () =>
          import('./credits/detail/portal-credit-detail.component').then(
            (c) => c.PortalCreditDetailComponent,
          ),
      },
      {
        path: 'simulator',
        canActivate: [portalTempPasswordGuard],
        loadComponent: () =>
          import('../../shared/simulator/simulator.component').then(
            (c) => c.SimulatorComponent,
          ),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];
