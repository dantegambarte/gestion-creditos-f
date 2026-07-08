import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { MessageService } from 'primeng/api';

const NETWORK_TOAST_KEY = 'network-status';

@Injectable({ providedIn: 'root' })
export class NetworkAwareService {
  private readonly messageService = inject(MessageService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private listening = false;
  private readonly onlineHandler = () => this.handleOnline();
  private readonly offlineHandler = () => this.handleOffline();

  readonly online = signal(true);

  /** Inicializa los listeners globales de conectividad una sola vez por sesión. */
  start(): void {
    if (this.listening || !isPlatformBrowser(this.platformId)) {
      return;
    }

    this.listening = true;
    this.online.set(window.navigator.onLine);
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);

    if (!window.navigator.onLine) {
      this.showOfflineToast();
    }

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('online', this.onlineHandler);
      window.removeEventListener('offline', this.offlineHandler);
      this.listening = false;
    });
  }

  /** Expone el estado actual para bloquear futuras escrituras HTTP críticas. */
  isOnline(): boolean {
    return this.online();
  }

  /** Registra la restauración de conectividad y reemplaza el aviso persistente. */
  private handleOnline(): void {
    this.online.set(true);
    this.messageService.clear(NETWORK_TOAST_KEY);
    this.messageService.add({
      key: NETWORK_TOAST_KEY,
      severity: 'success',
      summary: 'Conexión restaurada',
    });
  }

  /** Registra la pérdida de conectividad y muestra un aviso persistente. */
  private handleOffline(): void {
    this.online.set(false);
    this.showOfflineToast();
  }

  /** Muestra el toast persistente de offline sin duplicarlo manualmente. */
  private showOfflineToast(): void {
    this.messageService.clear(NETWORK_TOAST_KEY);
    this.messageService.add({
      key: NETWORK_TOAST_KEY,
      severity: 'warn',
      summary: 'Sin conexión',
      detail: 'Sin conexión. Algunas funciones pueden no estar disponibles.',
      sticky: true,
    });
  }
}
