import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { ActiveTabScrollerDirective } from '../../../shared/directives/active-tab-scroller.directive';

interface NavItem {
  label: string;
  icon: string;
  path: string;
}

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ActiveTabScrollerDirective],
  templateUrl: './config.component.html',
})
export class ConfigComponent {
  private auth = inject(AuthServiceBase);

  navItems: NavItem[] = [
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
    { label: 'Feriados', icon: 'pi pi-calendar-plus', path: 'holidays' },
    { label: 'Notificaciones', icon: 'pi pi-bell', path: 'notifications' },
  ];

  /**
   * Cierra la sesión del usuario autenticado.
   */
  logout(): void {
    this.auth.logout();
  }
}
