import { Injectable, inject } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthServiceBase } from '../auth/auth-service.base';
import { UserRole } from '../models/types/user-role';

/**
 * Precarga únicamente la feature que corresponde al rol del usuario autenticado.
 * Rutas sin `data.roles` (portal, login, públicas) se omiten.
 */
@Injectable({ providedIn: 'root' })
export class RoleBasedPreloadingStrategy implements PreloadingStrategy {
  private auth = inject(AuthServiceBase);

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const requiredRoles = route.data?.['roles'] as UserRole[] | undefined;

    if (!requiredRoles?.length) return of(null);
    if (!this.auth.isAuthenticated()) return of(null);
    if (!this.auth.hasAnyRole(requiredRoles)) return of(null);

    return load();
  }
}
