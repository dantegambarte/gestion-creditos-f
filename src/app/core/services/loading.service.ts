import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private activeRequests = 0;
  readonly isLoading = signal(false);

  /** Muestra el indicador de carga. */
  show(): void {
    this.activeRequests++;
    this.isLoading.set(true);
  }

  /**
   * Oculta el indicador sólo cuando no quedan requests concurrentes activas.
   */
  hide(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    if (this.activeRequests === 0) this.isLoading.set(false);
  }
}
