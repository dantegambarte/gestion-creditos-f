export enum AppRoutes {
  ADMIN = 'admin',
  APPROVALS = 'approvals',
  AUTH_LOGOUT = 'auth/logout',
  CASH_REGISTER = 'cash-register',
  CHANGE_PASSWORD = 'change-password',
  CLIENTS = 'clients',
  CLIENTS_DETAIL = 'clients/:id',
  CLIENTS_NEW = 'clients/new',
  COLLECTOR = 'collector',
  CONFIG = 'config',
  DASHBOARD = 'dashboard',
  DELINQUENCY = 'delinquency',
  FORGOT_PASSWORD = 'forgot-password',
  LOGIN = 'login',
  OPERATIONS = 'operations',
  OPERATIONS_DETAIL = 'operations/:id',
  OPERATIONS_NEW = 'operations/new',
  PRODUCTS = 'products',
  PRODUCTS_NEW = 'products/new',
  PRODUCTS_DETAIL = 'products/:id',
  PRODUCTS_EDIT = 'products/:id/edit',
  REPORTS = 'reports',
  ROUTE = '/collector/route',
  COLLECTOR_PAYMENTS = '/collector/payments',
  SELLER = 'seller',
  SHEET = 'sheet',
  USERS = 'users',
  USERS_DETAIL = 'users/:id',
  USERS_NEW = 'users/new',

  // Admin expenses
  ADMIN_EXPENSES = 'expenses',

  // Admin collections, payments & commissions
  ADMIN_COMMISSIONS = 'commissions',
  ADMIN_COLLECTIONS = 'collections',
  ADMIN_COLLECTIONS_NEW = 'collections/new',
  ADMIN_COLLECTIONS_DETAIL = 'collections/:id',
  ADMIN_PAYMENTS = 'payments',

  // Portal cliente
  PORTAL = 'portal',
  PORTAL_LOGIN = '/portal/login',
  PORTAL_DASHBOARD = '/portal/dashboard',
  PORTAL_CREDITS = '/portal/credits',
  PORTAL_CREDIT_DETAIL = '/portal/credits/:id',
  PORTAL_CHANGE_PASSWORD = '/portal/change-password',

  // Simulator
  SIMULATOR = 'simulator',
  PORTAL_SIMULATOR = '/portal/simulator',

  // Profile
  PROFILE = 'profile',

  // Seller
  SELLER_OPERATIONS = 'seller/operations/new',
  SELLER_OPERATIONS_DETAIL = 'seller/operations/:id',
  SELLER_PRODUCTS = 'seller/products',
  SELLER_PRODUCTS_NEW = 'seller/products/new',
  SELLER_PRODUCTS_DETAIL = 'seller/products/:id',
  SELLER_PRODUCTS_EDIT = 'seller/products/:id/edit',
  SELLER_COMMISSIONS = '/seller/commissions',
  COLLECTOR_COMMISSIONS = '/collector/commissions',
}
