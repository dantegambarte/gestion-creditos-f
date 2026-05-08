import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppRoutes } from '../../../shared/models/enums/routes.enum';
import { PortalAuthService } from '../auth/portal-auth.service';

@Component({
  selector: 'app-portal-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './portal-layout.component.html',
})
export class PortalLayoutComponent {
  private readonly auth = inject(PortalAuthService);
  private readonly router = inject(Router);

  readonly changePasswordRoute = AppRoutes.PORTAL_CHANGE_PASSWORD;
  readonly dashboardRoute      = AppRoutes.PORTAL_DASHBOARD;
  readonly creditsRoute        = AppRoutes.PORTAL_CREDITS;
  readonly simulatorRoute      = AppRoutes.PORTAL_SIMULATOR;

  /**
   * Devuelve el cliente autenticado actualmente, o null si no hay ninguno.
   */
  get customer() {
    return this.auth.snapshot;
  }

  /**
   * Devuelve las iniciales del nombre completo del cliente (máximo 2 caracteres).
   */
  get initials(): string {
    const name = this.customer?.fullName ?? '';
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0] ?? '')
      .join('')
      .toUpperCase();
  }

  /**
   * Cierra la sesión del cliente actual y redirige a la página de login del portal.
   */
  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigate([AppRoutes.PORTAL_LOGIN]),
      error: () => this.router.navigate([AppRoutes.PORTAL_LOGIN]),
    });
  }
}
