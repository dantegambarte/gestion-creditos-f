import { AsyncPipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Message, MessageService, PrimeNGConfig } from 'primeng/api';
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
  private primengConfig = inject(PrimeNGConfig);
  private messageService = inject(MessageService);
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);

  private noLayoutRoutes = ['/portal', '/change-password'];
  liveAnnouncement = '';

  constructor() {
    this.configurePrimeNgLocale();
    this.resetScrollOnNavigation();
    this.announceGlobalToasts();
  }

  /**
   * Configura la localización global de PrimeNG en español para calendarios y etiquetas comunes.
   */
  private configurePrimeNgLocale(): void {
    this.primengConfig.setTranslation({
      dayNames: [
        'domingo',
        'lunes',
        'martes',
        'miércoles',
        'jueves',
        'viernes',
        'sábado',
      ],
      dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
      dayNamesMin: ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sa'],
      monthNames: [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ],
      monthNamesShort: [
        'ene',
        'feb',
        'mar',
        'abr',
        'may',
        'jun',
        'jul',
        'ago',
        'sep',
        'oct',
        'nov',
        'dic',
      ],
      today: 'Hoy',
      clear: 'Limpiar',
      dateFormat: 'yy-mm-dd',
      weekHeader: 'Sem',
    });
  }

  /**
   * Reinicia el scroll global al cambiar de pantalla para evitar heredar la posición anterior.
   */
  private resetScrollOnNavigation(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        requestAnimationFrame(() => {
          const shellMain = this.document.querySelector('.ff-shell__main');
          if (shellMain instanceof HTMLElement) {
            shellMain.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          }

          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        });
      });
  }

  /**
   * Publica los toasts globales en una región aria-live para lectores de pantalla.
   */
  private announceGlobalToasts(): void {
    const subscription = this.messageService.messageObserver.subscribe(
      (message) => {
        const messages = Array.isArray(message) ? message : [message];
        this.liveAnnouncement = messages
          .map((item) => this.toAnnouncementText(item))
          .filter(Boolean)
          .join('. ');
      },
    );

    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  /**
   * Convierte un mensaje visual de PrimeNG en texto claro para tecnología asistiva.
   * @param message - Toast emitido por MessageService.
   */
  private toAnnouncementText(message: Message): string {
    return [message.summary, message.detail].filter(Boolean).join(': ');
  }

  /** Indica si una URL debe renderizarse sin shell administrativo. */
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
