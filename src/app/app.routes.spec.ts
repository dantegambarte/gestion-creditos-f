import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { Roles } from './shared/models/enums/roles.enum';
import { AppRoutes } from './shared/models/enums/routes.enum';
import { routes } from './app.routes';

describe('app routes security', () => {
  it('protege todas las rutas privadas de negocio con authGuard', () => {
    const privateRoots = [
      AppRoutes.CHANGE_PASSWORD,
      AppRoutes.ADMIN,
      AppRoutes.SELLER,
      AppRoutes.COLLECTOR,
      AppRoutes.PROFILE,
    ];

    for (const path of privateRoots) {
      const route = routes.find((item) => item.path === path);
      expect(route?.canActivate).withContext(path).toContain(authGuard);
    }
  });

  it('protege roots de negocio por rol estricto', () => {
    const adminRoute = routes.find((item) => item.path === AppRoutes.ADMIN);
    const sellerRoute = routes.find((item) => item.path === AppRoutes.SELLER);
    const collectorRoute = routes.find(
      (item) => item.path === AppRoutes.COLLECTOR,
    );

    expect(adminRoute?.canActivate).toContain(roleGuard);
    expect(adminRoute?.data?.['roles']).toEqual([Roles.ADMIN]);

    expect(sellerRoute?.canActivate).toContain(roleGuard);
    expect(sellerRoute?.data?.['roles']).toEqual([
      Roles.SELLER,
      Roles.ADMIN,
      Roles.COLLECTOR,
      Roles.SELLER_COLLECTOR,
    ]);

    expect(collectorRoute?.canActivate).toContain(roleGuard);
    expect(collectorRoute?.data?.['roles']).toEqual([
      Roles.COLLECTOR,
      Roles.SELLER_COLLECTOR,
    ]);
  });
});
