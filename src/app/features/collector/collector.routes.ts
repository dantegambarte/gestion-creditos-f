import { Routes } from '@angular/router';
import { AppRoutes } from '../../shared/models/enums/routes.enum';

export const COLLECTOR_ROUTES: Routes = [
  {
    path: 'route',
    loadComponent: () =>
      import('./route/route.component').then((c) => c.RouteComponent),
  },
  {
    path: 'route/:sheetId',
    loadComponent: () =>
      import('./collection-sheet-detail/collection-sheet-detail.component').then(
        (c) => c.CollectionSheetDetailComponent,
      ),
  },
  {
    path: 'payments',
    loadComponent: () =>
      import('./collector-payments/collector-payments.component').then(
        (c) => c.CollectorPaymentsComponent,
      ),
  },
  {
    path: 'commissions',
    loadComponent: () =>
      import('./commissions/collector-commissions.component').then(
        (c) => c.CollectorCommissionsComponent,
      ),
  },
  {
    path: AppRoutes.SIMULATOR,
    loadComponent: () =>
      import('../../shared/simulator/simulator.component').then(
        (c) => c.SimulatorComponent,
      ),
  },
  { path: '', redirectTo: 'route', pathMatch: 'full' },
];
