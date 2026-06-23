export interface LoginUserPayload {
  id: string;
  full_name: string;
  dni?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  role: string;
  status?: string;
  is_temp_password: boolean;
  last_login_at?: string | null;
  created_at?: string | null;
}

export interface LoginResponseData {
  token: string;
  user: LoginUserPayload;
}

export interface MeResponseData {
  id: string;
  full_name: string;
  dni?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  role: string;
  status: string;
  is_temp_password: boolean;
  force_relogin_at: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
  pending_approvals_count?: number;
}

export interface LoginCredentials {
  dni: string;
  password: string;
}
