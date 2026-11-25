import { UserRole } from '../../shared/models/enums/roles.enum';
import { LOGIN_ROUTE, landingRouteForRoles } from './role-routes';

describe('landingRouteForRoles', () => {
  const cases: Array<[UserRole[] | undefined, string]> = [
    [['ADMIN'], '/admin/dashboard'],
    [['SELLER'], '/seller/operations'],
    [['COLLECTOR'], '/collector/route'],
    [['SELLER_COLLECTOR'], '/collector/route'],
    [['CASHIER'], '/login'],
    [['ADMIN', 'SELLER'], '/admin/dashboard'],
    [[], '/login'],
    [undefined, '/login'],
  ];

  cases.forEach(([roles, expected]) => {
    it(`resuelve ${JSON.stringify(roles)} -> ${expected}`, () => {
      expect(landingRouteForRoles(roles)).toBe(expected);
    });
  });

  it('siempre devuelve rutas absolutas', () => {
    cases.forEach(([roles]) => expect(landingRouteForRoles(roles).startsWith('/')).toBeTrue());
    expect(LOGIN_ROUTE).toBe('/login');
  });
});
