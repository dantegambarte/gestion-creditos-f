import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../../core/http/api-http.service';
import {
  CreateResponseRaw,
  UserDetailRaw,
  UserRaw,
} from '../../collector/models/interface/user-raw';
import {
  User,
  UserCreatePayload,
  UserDetail,
  UserListFilters,
  UserUpdatePayload,
} from './user.model';

/**
 * Convierte un UserRaw (formato del backend) a User (formato de la app).
 * @param raw
 * @returns
 */
function toUser(raw: UserRaw): User {
  return {
    id: raw.id,
    fullName: raw.full_name,
    dni: raw.dni,
    email: raw.email,
    address: raw.address,
    role: raw.role,
    status: raw.status,
    isTempPassword: raw.is_temp_password,
    failedAttempts: raw.failed_attempts,
    lockedAt: raw.locked_at,
    lastLoginAt: raw.last_login_at,
    createdAt: raw.created_at,
  };
}

/**
 * Convierte un UserDetailRaw (formato del backend) a UserDetail (formato de la app).
 * @param raw
 * @returns
 */
function toUserDetail(raw: UserDetailRaw): UserDetail {
  return { ...toUser(raw), updatedAt: raw.updated_at };
}

/**
 * Convierte un UserCreatePayload (formato de la app) a un objeto para el cuerpo de la solicitud HTTP.
 * @param p
 * @returns
 */
function fromCreatePayload(p: UserCreatePayload): Record<string, unknown> {
  const body: Record<string, unknown> = {
    full_name: p.fullName,
    dni: p.dni,
    role: p.role,
  };
  if (p.email) body['email'] = p.email;
  if (p.address) body['address'] = p.address;
  return body;
}

/**
 * Convierte un UserUpdatePayload (formato de la app) a un objeto para el cuerpo de la solicitud HTTP.
 * @param p
 * @returns
 */
function fromUpdatePayload(p: UserUpdatePayload): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (p.fullName !== undefined) body['full_name'] = p.fullName;
  if (p.dni !== undefined) body['dni'] = p.dni;
  if (p.email !== undefined) body['email'] = p.email;
  if (p.address !== undefined) body['address'] = p.address;
  if (p.role !== undefined) body['role'] = p.role;
  return body;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = inject(ApiHttpService);

  /**
   * Lista los usuarios según los filtros especificados.
   * @param filters
   * @returns
   */
  list(filters?: UserListFilters): Observable<User[]> {
    const params: Record<string, string> = {};
    if (filters?.role) params['role'] = filters.role;
    if (filters?.roles) params['roles'] = filters.roles;
    if (filters?.status) params['status'] = filters.status;
    if (filters?.search) params['search'] = filters.search;
    return this.api
      .get<UserRaw[]>('users', params)
      .pipe(map((items) => items.map(toUser)));
  }

  /**
   * Lista los usuarios que pueden cobrar: COLLECTOR + SELLER_COLLECTOR (doble
   * función). Es el listado de "cobradores" usado en planillas, filtros y
   * asignación de clientes.
   * @returns
   */
  listCollectors(): Observable<User[]> {
    return this.list({ roles: 'COLLECTOR,SELLER_COLLECTOR', status: 'ACTIVE' });
  }

  /**
   * Obtiene un usuario por su ID.
   * @param id
   * @returns
   */
  getById(id: string): Observable<UserDetail> {
    return this.api.get<UserDetailRaw>(`users/${id}`).pipe(map(toUserDetail));
  }

  /**
   * Crea un nuevo usuario.
   * @param payload
   * @returns
   */
  create(
    payload: UserCreatePayload,
  ): Observable<{ user: UserDetail; tempPassword: string }> {
    return this.api
      .post<CreateResponseRaw>('users', fromCreatePayload(payload))
      .pipe(
        map((raw) => ({
          user: toUserDetail(raw.user),
          tempPassword: raw.tempPassword,
        })),
      );
  }

  /**
   * Actualiza un usuario existente.
   * @param id
   * @param payload
   * @returns
   */
  update(id: string, payload: UserUpdatePayload): Observable<UserDetail> {
    return this.api
      .put<UserDetailRaw>(`users/${id}`, fromUpdatePayload(payload))
      .pipe(map(toUserDetail));
  }

  /**
   * Desactiva un usuario (cambia su estado a INACTIVE).
   * @param id
   * @returns
   */
  deactivate(id: string): Observable<void> {
    return this.api
      .patch<void>(`users/${id}/deactivate`)
      .pipe(map(() => undefined));
  }

  /**
   * Activa un usuario (cambia su estado a ACTIVE).
   * @param id
   * @returns
   */
  activate(id: string): Observable<void> {
    return this.api
      .patch<void>(`users/${id}/activate`)
      .pipe(map(() => undefined));
  }

  /**
   * Resetea la contraseña de un usuario, generando una nueva temporal.
   * @param id
   * @returns
   */
  resetPassword(id: string): Observable<{ tempPassword: string }> {
    return this.api.patch<{ tempPassword: string }>(
      `users/${id}/reset-password`,
    );
  }

  /**
   * Desbloquea un usuario que ha sido bloqueado por múltiples intentos fallidos de inicio de sesión.
   * @param id
   * @returns
   */
  unlock(id: string): Observable<void> {
    return this.api
      .patch<void>(`users/${id}/unlock`)
      .pipe(map(() => undefined));
  }
}
