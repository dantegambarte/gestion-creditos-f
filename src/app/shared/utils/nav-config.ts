import { AppRoutes } from '../models/enums/routes.enum';
import { NavItem } from '../models/interface/nav-item';

// SELLER_COLLECTOR comparte las rutas del módulo /seller
function sellerPrefix(role: string): string {
  return role === 'ADMIN' ? 'admin' : 'seller';
}

export const NAV_CONFIG: NavItem[] = [
  {
    label: 'Principal',
    requiredRoles: ['ADMIN'],
    isGroupLabel: true,
  },
  {
    label: 'Dashboard',
    icon: 'pi pi-th-large',
    route: `/${AppRoutes.ADMIN}/${AppRoutes.DASHBOARD}`,
    requiredRoles: ['ADMIN'],
  },

  {
    label: 'Gestión',
    requiredRoles: ['ADMIN', 'SELLER', 'SELLER_COLLECTOR'],
    isGroupLabel: true,
  },
  {
    label: 'Operaciones',
    icon: 'pi pi-file-edit',
    route: (role) => `/${sellerPrefix(role)}/${AppRoutes.OPERATIONS}`,
    requiredRoles: ['ADMIN', 'SELLER', 'SELLER_COLLECTOR'],
  },
  {
    label: 'Clientes',
    icon: 'pi pi-users',
    route: (role) => `/${sellerPrefix(role)}/${AppRoutes.CLIENTS}`,
    requiredRoles: ['ADMIN', 'SELLER', 'SELLER_COLLECTOR'],
  },
  {
    label: 'Productos',
    icon: 'pi pi-box',
    route: (role) => `/${sellerPrefix(role)}/${AppRoutes.PRODUCTS}`,
    requiredRoles: ['ADMIN', 'SELLER', 'SELLER_COLLECTOR'],
  },
  {
    label: 'Simulador',
    icon: 'pi pi-calculator',
    route: (role) => `/${sellerPrefix(role)}/${AppRoutes.SIMULATOR}`,
    requiredRoles: ['ADMIN', 'SELLER', 'SELLER_COLLECTOR'],
  },

  {
    label: 'Administración',
    requiredRoles: ['ADMIN'],
    isGroupLabel: true,
  },
  {
    label: 'Usuarios',
    icon: 'pi pi-user',
    route: `/${AppRoutes.ADMIN}/${AppRoutes.USERS}`,
    requiredRoles: ['ADMIN'],
  },
  // TODO: implementar la cantidad de "aprobaciones" (falta que devuelve el backend en el me, la cantidad de aprobaciones)
  {
    label: 'Aprobaciones',
    icon: 'pi pi-check-square',
    route: `/${AppRoutes.ADMIN}/${AppRoutes.APPROVALS}`,
    requiredRoles: ['ADMIN'],
    badge: 3,
    testId: 'nav-aprobaciones',
  },
  {
    label: 'Planillas de cobro',
    icon: 'pi pi-calendar',
    route: `/${AppRoutes.ADMIN}/${AppRoutes.ADMIN_COLLECTIONS}`,
    requiredRoles: ['ADMIN'],
  },
  {
    label: 'Cobros',
    icon: 'pi pi-money-bill',
    route: `/${AppRoutes.ADMIN}/${AppRoutes.ADMIN_PAYMENTS}`,
    requiredRoles: ['ADMIN'],
  },
  {
    label: 'Mora y Canc.',
    icon: 'pi pi-exclamation-triangle',
    route: `/${AppRoutes.ADMIN}/${AppRoutes.DELINQUENCY}`,
    requiredRoles: ['ADMIN'],
  },
  {
    label: 'Caja',
    icon: 'pi pi-wallet',
    route: `/${AppRoutes.ADMIN}/${AppRoutes.CASH_REGISTER}`,
    requiredRoles: ['ADMIN'],
  },
  {
    label: 'Gastos',
    icon: 'pi pi-minus-circle',
    route: `/${AppRoutes.ADMIN}/${AppRoutes.ADMIN_EXPENSES}`,
    requiredRoles: ['ADMIN'],
  },
  {
    label: 'Liquidaciones',
    icon: 'pi pi-money-bill',
    route: `/${AppRoutes.ADMIN}/${AppRoutes.ADMIN_COMMISSIONS}`,
    requiredRoles: ['ADMIN'],
    dividerAfter: true,
  },

  {
    label: 'Sistema',
    requiredRoles: ['ADMIN'],
    isGroupLabel: true,
  },
  {
    label: 'Reportes',
    icon: 'pi pi-chart-bar',
    route: `/${AppRoutes.ADMIN}/${AppRoutes.REPORTS}`,
    requiredRoles: ['ADMIN'],
  },
  {
    label: 'Configuración',
    icon: 'pi pi-cog',
    route: `/${AppRoutes.ADMIN}/${AppRoutes.CONFIG}`,
    requiredRoles: ['ADMIN'],
  },

  {
    label: 'Mis comisiones',
    icon: 'pi pi-percentage',
    route: AppRoutes.SELLER_COMMISSIONS,
    requiredRoles: ['SELLER'],
  },

  {
    label: 'Cobranza en campo',
    requiredRoles: ['COLLECTOR', 'SELLER_COLLECTOR'],
    isGroupLabel: true,
  },
  {
    label: 'Mi Ruta',
    icon: 'pi pi-map',
    route: AppRoutes.ROUTE,
    requiredRoles: ['COLLECTOR', 'SELLER_COLLECTOR'],
  },
  {
    label: 'Mis cobros',
    icon: 'pi pi-dollar',
    route: AppRoutes.COLLECTOR_PAYMENTS,
    requiredRoles: ['COLLECTOR', 'SELLER_COLLECTOR'],
  },
  {
    label: 'Mis comisiones',
    icon: 'pi pi-percentage',
    route: AppRoutes.COLLECTOR_COMMISSIONS,
    requiredRoles: ['COLLECTOR', 'SELLER_COLLECTOR'],
  },
  {
    label: 'Simulador',
    icon: 'pi pi-calculator',
    route: `/collector/${AppRoutes.SIMULATOR}`,
    requiredRoles: ['COLLECTOR'],
  },
];
