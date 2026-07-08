import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { MessageService } from 'primeng/api';
import { filter } from 'rxjs/operators';

const PWA_UPDATE_TOAST_KEY = 'pwa-update';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly messageService = inject(MessageService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private listening = false;

  /** Inicializa el listener de nuevas versiones sólo cuando el Service Worker está activo. */
  start(): void {
    if (this.listening || !this.swUpdate.isEnabled) {
      return;
    }

    this.listening = true;
    this.swUpdate.versionUpdates
      .pipe(
        filter(
          (event): event is VersionReadyEvent => event.type === 'VERSION_READY',
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.showUpdateToast());
  }

  /** Muestra una acción persistente para recargar y aplicar la versión disponible. */
  private showUpdateToast(): void {
    this.messageService.clear(PWA_UPDATE_TOAST_KEY);
    this.messageService.add({
      key: PWA_UPDATE_TOAST_KEY,
      severity: 'info',
      summary: 'Actualización disponible',
      detail: 'Nueva versión de Productcred s.a.s. disponible.',
      sticky: true,
      data: {
        actionLabel: 'Actualizar ahora',
        action: () => this.document.location.reload(),
      },
    });
  }
}
