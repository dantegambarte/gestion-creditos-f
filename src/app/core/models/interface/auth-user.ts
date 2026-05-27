import { UserRole } from '../types/user-role';

export interface AuthUser {
  id: string;
  /** Campo backend. Usar este para lógica. */
  full_name: string;
  /** Alias de full_name — mantenido para compatibilidad con templates existentes. */
  name: string;
  dni?: string;
  /** Roles como array. Backend devuelve role singular; adapter lo envuelve en [role]. */
  roles: UserRole[];
  /** Iniciales calculadas del full_name — usado en avatar UI. */
  avatar: string;
  is_temp_password: boolean;
  force_relogin_at: string | null;
  token: string;
  pending_approvals_count?: number;
  /** Opcional: solo presente en mock para acceso rápido. */
  email?: string;
}
