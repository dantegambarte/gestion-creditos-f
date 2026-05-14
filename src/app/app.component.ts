import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { filter, map } from 'rxjs/operators';
import { AuthServiceBase } from './core/auth/auth-service.base';
import { HeaderComponent } from './shared/layout/header/header.component';
import { SidebarComponent } from './shared/layout/sidebar/sidebar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    HeaderComponent,
    AsyncPipe,
    ToastModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'gestion-creditos-f';

  auth = inject(AuthServiceBase);
  private router = inject(Router);

  private noLayoutRoutes = ['/portal', '/change-password'];

  private matchesNoLayout(url: string): boolean {
    return this.noLayoutRoutes.some((r) => url.startsWith(r));
  }

  /**
   * Señal que indica si la ruta actual es una ruta de portal o cambio de contraseña, lo que implica que no se debe mostrar el header ni el sidebar.
   */
  isPortalRoute = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => this.matchesNoLayout((e as NavigationEnd).urlAfterRedirects)),
    ),
    { initialValue: this.matchesNoLayout(this.router.url) },
  );
}
