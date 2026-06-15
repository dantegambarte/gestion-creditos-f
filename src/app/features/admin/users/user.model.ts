import { UserRole } from '../../../core/models/types/user-role';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  fullName: string;
  dni: string;
  email: string | null;
  address: string | null;
  role: UserRole;
  status: UserStatus;
  isTempPassword: boolean;
  failedAttempts: number;
  lockedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UserDetail extends User {
  updatedAt: string;
}

export interface UserListFilters {
  role?: UserRole;
  /** Conjunto de roles (CSV, ej: 'COLLECTOR,SELLER_COLLECTOR'). Tiene prioridad sobre role. */
  roles?: string;
  status?: UserStatus;
  search?: string;
}

export interface UserCreatePayload {
  fullName: string;
  dni: string;
  email?: string;
  address?: string;
  role: UserRole;
}

export interface UserUpdatePayload {
  fullName?: string;
  dni?: string;
  email?: string;
  address?: string;
  role?: UserRole;
}
