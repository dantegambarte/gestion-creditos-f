import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';

interface NavItem {
  label: string;
  icon: string;
  path: string;
}

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './config.component.html',
})
export class ConfigComponent {
  private auth = inject(AuthServiceBase);

  navItems: NavItem[] = [
    { label: 'General', icon: 'pi pi-building', path: 'company' },
    { label: 'Tasas de Interés', icon: 'pi pi-percentage', path: 'rates' },
    {
      label: 'Tasa por Producto',
      icon: 'pi pi-chart-line',
      path: 'product-rates',
    },
    {
      label: 'Parámetros del Sistema',
      icon: 'pi pi-sliders-h',
      path: 'system-params',
    },
    { label: 'Usuarios', icon: 'pi pi-users', path: 'users' },
    { label: 'Notificaciones', icon: 'pi pi-bell', path: 'notifications' },
  ];

  /**
   * Cierra la sesión del usuario autenticado.
   */
  logout(): void {
    this.auth.logout();
  }
}
