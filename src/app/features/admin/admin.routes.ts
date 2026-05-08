import { Routes } from '@angular/router';
import { AppRoutes } from '../../shared/models/enums/routes.enum';

export const ADMIN_ROUTES: Routes = [
  {
    path: AppRoutes.DASHBOARD,
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(
        (c) => c.DashboardComponent,
      ),
  },
  {
    path: AppRoutes.OPERATIONS_NEW,
    loadComponent: () =>
      import('../../shared/operations/new-operation/new-operation.component').then(
        (c) => c.NewOperationComponent,
      ),
  },
  {
    path: AppRoutes.OPERATIONS_DETAIL,
    loadComponent: () =>
      import('../seller/operations/credit-detail/credit-detail.component').then(
        (c) => c.CreditDetailComponent,
      ),
  },
  {
    path: AppRoutes.OPERATIONS,
    loadComponent: () =>
      import('../../shared/operations/operations.component').then(
        (c) => c.OperationsComponent,
      ),
  },
  {
    path: AppRoutes.CLIENTS,
    loadComponent: () =>
      import('../../shared/clients/clients.component').then(
        (c) => c.ClientsComponent,
      ),
  },
  {
    path: AppRoutes.CLIENTS_DETAIL,
    loadComponent: () =>
      import('../../shared/clients/client-detail/client-detail.component').then(
        (c) => c.ClientDetailComponent,
      ),
  },
  {
    path: AppRoutes.PRODUCTS,
    loadComponent: () =>
      import('../seller/products/products-shell/products-shell.component').then(
        (c) => c.ProductsShellComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('../seller/products/products-list/products-list.component').then(
            (c) => c.ProductsListComponent,
          ),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('../seller/products/product-create/product-create.component').then(
            (c) => c.ProductCreateComponent,
          ),
      },
      {
        path: ':id/variants/:variantId/units',
        loadComponent: () =>
          import('../seller/products/product-units/product-units.component').then(
            (c) => c.ProductUnitsComponent,
          ),
      },
      {
        path: ':id/variants',
        loadComponent: () =>
          import('../seller/products/product-variants/product-variants.component').then(
            (c) => c.ProductVariantsComponent,
          ),
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import('../seller/products/product-edit/product-edit.component').then(
            (c) => c.ProductEditComponent,
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('../seller/products/product-detail/product-detail.component').then(
            (c) => c.ProductDetailComponent,
          ),
      },
      {
        path: 'config/categories',
        loadComponent: () =>
          import('./config/product-categories/product-categories-config.component').then(
            (c) => c.ProductCategoriesConfigComponent,
          ),
      },
      {
        path: 'config/brands',
        loadComponent: () =>
          import('./config/product-brands/product-brands-config.component').then(
            (c) => c.ProductBrandsConfigComponent,
          ),
      },
    ],
  },
  {
    path: AppRoutes.USERS_NEW,
    loadComponent: () =>
      import('./users/user-create/user-create.component').then(
        (c) => c.UserCreateComponent,
      ),
  },
  {
    path: AppRoutes.USERS_DETAIL,
    loadComponent: () =>
      import('./users/user-detail/user-detail.component').then(
        (c) => c.UserDetailComponent,
      ),
  },
  {
    path: AppRoutes.USERS,
    loadComponent: () =>
      import('./users/users-list/users-list.component').then(
        (c) => c.UsersListComponent,
      ),
  },
  {
    path: AppRoutes.APPROVALS,
    loadComponent: () =>
      import('./approvals/approvals.component').then(
        (c) => c.ApprovalsComponent,
      ),
  },
  {
    path: AppRoutes.DELINQUENCY,
    loadComponent: () =>
      import('./delinquency/delinquency.component').then(
        (c) => c.DelinquencyComponent,
      ),
  },
  {
    path: AppRoutes.CASH_REGISTER,
    loadComponent: () =>
      import('./cash-register/cash-register.component').then(
        (c) => c.CashRegisterComponent,
      ),
  },
  {
    path: AppRoutes.SHEET,
    loadComponent: () =>
      import('./sheet/sheet.component').then((c) => c.SheetComponent),
  },
  {
    path: AppRoutes.ADMIN_COMMISSIONS,
    loadComponent: () =>
      import('./commissions/commissions.component').then(
        (c) => c.CommissionsComponent,
      ),
  },
  {
    path: AppRoutes.REPORTS,
    loadComponent: () =>
      import('./reports/reports.component').then((c) => c.ReportsComponent),
  },
  {
    path: AppRoutes.CONFIG,
    loadComponent: () =>
      import('./config/config.component').then((c) => c.ConfigComponent),
  },
  {
    path: AppRoutes.ADMIN_COLLECTIONS_NEW,
    loadComponent: () =>
      import('./collections/generate/collection-generate.component').then(
        (c) => c.CollectionGenerateComponent,
      ),
  },
  {
    path: AppRoutes.ADMIN_COLLECTIONS_DETAIL,
    loadComponent: () =>
      import('./collections/admin-collection-detail.component').then(
        (c) => c.AdminCollectionDetailComponent,
      ),
  },
  {
    path: AppRoutes.ADMIN_COLLECTIONS,
    loadComponent: () =>
      import('./collections/admin-collections.component').then(
        (c) => c.AdminCollectionsComponent,
      ),
  },
  {
    path: AppRoutes.ADMIN_PAYMENTS,
    loadComponent: () =>
      import('./payments/admin-payments.component').then(
        (c) => c.AdminPaymentsComponent,
      ),
  },
  {
    path: AppRoutes.ADMIN_EXPENSES,
    loadComponent: () =>
      import('./expenses/expenses.component').then((c) => c.ExpensesComponent),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];
