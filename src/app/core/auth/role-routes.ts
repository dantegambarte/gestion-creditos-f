import { Roles, UserRole } from '../../shared/models/enums/roles.enum';

/** Ruta absoluta del login, destino de quien no tiene un área propia. */
export const LOGIN_ROUTE = '/login';

/**
 * Orden de prioridad rol → ruta de aterrizaje. Única fuente de verdad usada por
 * guards, login, cambio de contraseña y servicios de autenticación.
 * SELLER_COLLECTOR arranca en Mi Ruta: su tarea principal es la cobranza.
 * CASHIER todavía no tiene un área propia en el frontend.
 */
const LANDING_BY_ROLE: ReadonlyArray<readonly [UserRole, string]> = [
  [Roles.ADMIN, '/admin/dashboard'],
  [Roles.SELLER, '/seller/operations'],
  [Roles.COLLECTOR, '/collector/route'],
  [Roles.SELLER_COLLECTOR, '/collector/route'],
];

/**
 * Resuelve la ruta absoluta donde aterriza un usuario según sus roles.
 * @param roles - Roles del usuario autenticado, si están disponibles.
 * @returns Ruta absoluta; `/login` cuando ningún rol tiene área asignada.
 */
export function landingRouteForRoles(roles: readonly string[] | null | undefined): string {
  const match = LANDING_BY_ROLE.find(([role]) => roles?.includes(role));
  return match ? match[1] : LOGIN_ROUTE;
}

/**
 * Indica si los roles incluyen acceso al área de administración.
 * @param roles - Roles del usuario autenticado.
 */
export function isAdminRole(roles: readonly string[] | null | undefined): boolean {
  return !!roles?.includes(Roles.ADMIN);
}
