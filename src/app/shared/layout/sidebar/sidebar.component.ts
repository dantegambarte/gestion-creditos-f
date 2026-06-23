import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { RippleModule } from 'primeng/ripple';
import { filter, map } from 'rxjs/operators';
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
  ],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  private auth = inject(AuthServiceBase);
  private router = inject(Router);

  currentUser = toSignal(this.auth.currentUser$, { initialValue: null });
  mobileMenuOpen = signal(false);
  activeUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => (event as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  mobilePrimaryItems = computed(() =>
    this.visibleItems
      .filter((item) => !item.isGroupLabel && !!item.route)
      .slice(0, 4),
  );

  /**
   * Devuelve la navegación visible para el usuario actual usando el estado reactivo de autenticación.
   */
  get visibleItems(): ResolvedNavItem[] {
    return this.filterByRole(this.currentUser());
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
   * Indica si una ruta debe marcarse activa en la navegación mobile.
   * @param route - Ruta resuelta del item de navegación.
   */
  isRouteActive(route?: string): boolean {
    if (!route) return false;

    const url = this.activeUrl();
    return url === route || url.startsWith(`${route}/`);
  }

  /**
   * Abre o cierra el menú mobile secundario sin afectar el sidebar desktop.
   */
  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  /**
   * Cierra el menú mobile luego de navegar para liberar el viewport.
   */
  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  /**
   * Cierra la sesión del usuario actual. Se llama al hacer clic en "Cerrar Sesión" en el sidebar.
   * Redirige a la página de login y limpia el estado de autenticación.
   */
  logout(): void {
    this.closeMobileMenu();
    this.auth.logout();
  }
}
