import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { RippleModule } from 'primeng/ripple';
import { TooltipModule } from 'primeng/tooltip';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { AuthUser } from '../../../core/models/interface/auth-user';
import { NavItem, ResolvedNavItem } from '../../models/interface/nav-item';
import { NAV_CONFIG } from '../../utils/nav-config';

@Component({
  selector: 'sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    BadgeModule,
    AvatarModule,
    RippleModule,
    TooltipModule,
  ],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit, OnDestroy {
  currentUser: AuthUser | null = null;
  visibleItems: ResolvedNavItem[] = [];
  private destroy$ = new Subject<void>();

  constructor(private auth: AuthServiceBase) {}

  ngOnInit(): void {
    this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
      this.visibleItems = this.filterByRole(user);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   *  Filtra los elementos de navegación según los roles del usuario. Solo se mostrarán los elementos para los cuales el usuario tiene al menos uno de los roles requeridos.
   *  Además, si la ruta del elemento es una función, se resuelve en una cadena utilizando el rol principal del usuario.
   * @param user
   * @returns
   */
  filterByRole(user: AuthUser | null): ResolvedNavItem[] {
    if (!user) return [];

    const userRole = user.roles[0];

    return NAV_CONFIG.filter(
      (item) =>
        item.requiredRoles.length === 0 ||
        item.requiredRoles.some((r) => user.roles.includes(r)),
    ).map((item) => ({
      ...item,
      route:
        typeof item.route === 'function' ? item.route(userRole) : item.route,
      badge:
        typeof item.badge === 'function' ? item.badge(user) : item.badge,
    }));
  }

  /**
   * Cierra la sesión del usuario actual. Se llama al hacer clic en "Cerrar Sesión" en el sidebar.
   * Redirige a la página de login y limpia el estado de autenticación.
   */
  logout(): void {
    this.auth.logout();
  }
}
