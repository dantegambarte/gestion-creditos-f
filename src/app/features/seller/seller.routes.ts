import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';
import { AppRoutes } from '../../shared/models/enums/routes.enum';

export const SELLER_ROUTES: Routes = [
  {
    path: AppRoutes.OPERATIONS,
    loadComponent: () =>
      import('./operations/credits-list/credits-list.component').then(
        (c) => c.CreditsListComponent,
      ),
  },
  {
    path: AppRoutes.OPERATIONS_NEW,
    canActivate: [roleGuard],
    data: { roles: ['ADMIN', 'SELLER', 'SELLER_COLLECTOR'] },
    loadComponent: () =>
      import('./operations/credit-create/credit-create.component').then(
        (c) => c.CreditCreateComponent,
      ),
  },
  {
    path: AppRoutes.OPERATIONS_DETAIL,
    loadComponent: () =>
      import('./operations/credit-detail/credit-detail.component').then(
        (c) => c.CreditDetailComponent,
      ),
  },
  {
    path: AppRoutes.CLIENTS,
    canActivate: [roleGuard],
    data: { roles: ['ADMIN', 'SELLER', 'COLLECTOR', 'SELLER_COLLECTOR'] },
    loadComponent: () =>
      import('./clients/clients-list/clients-list.component').then(
        (c) => c.ClientsListComponent,
      ),
  },
  {
    path: AppRoutes.CLIENTS_NEW,
    canActivate: [roleGuard],
    data: { roles: ['ADMIN', 'SELLER', 'SELLER_COLLECTOR'] },
    loadComponent: () =>
      import('./clients/client-create/client-create.component').then(
        (c) => c.ClientCreateComponent,
      ),
  },
  {
    path: AppRoutes.CLIENTS_DETAIL,
    canActivate: [roleGuard],
    data: { roles: ['ADMIN', 'SELLER', 'COLLECTOR', 'SELLER_COLLECTOR'] },
    loadComponent: () =>
      import('./clients/client-detail/client-detail.component').then(
        (c) => c.ClientDetailComponent,
      ),
  },
  {
    path: AppRoutes.PRODUCTS,
    loadComponent: () =>
      import('./products/products-shell/products-shell.component').then(
        (c) => c.ProductsShellComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./products/products-list/products-list.component').then(
            (c) => c.ProductsListComponent,
          ),
      },
      {
        path: 'new',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () =>
          import('./products/product-create/product-create.component').then(
            (c) => c.ProductCreateComponent,
          ),
      },
      {
        path: ':id/variants/:variantId/units',
        loadComponent: () =>
          import('./products/product-units/product-units.component').then(
            (c) => c.ProductUnitsComponent,
          ),
      },
      {
        path: ':id/variants',
        loadComponent: () =>
          import('./products/product-variants/product-variants.component').then(
            (c) => c.ProductVariantsComponent,
          ),
      },
      {
        path: ':id/edit',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () =>
          import('./products/product-edit/product-edit.component').then(
            (c) => c.ProductEditComponent,
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./products/product-detail/product-detail.component').then(
            (c) => c.ProductDetailComponent,
          ),
      },
      {
        path: 'config/categories',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () =>
          import('../admin/config/product-categories/product-categories-config.component').then(
            (c) => c.ProductCategoriesConfigComponent,
          ),
      },
      {
        path: 'config/brands',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () =>
          import('../admin/config/product-brands/product-brands-config.component').then(
            (c) => c.ProductBrandsConfigComponent,
          ),
      },
    ],
  },
  {
    path: 'commissions',
    loadComponent: () =>
      import('./commissions/seller-commissions.component').then(
        (c) => c.SellerCommissionsComponent,
      ),
  },
  { path: '', redirectTo: 'operations', pathMatch: 'full' },
];
