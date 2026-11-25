import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './error-state.component.html',
})
export class ErrorStateComponent {
  @Input() message = 'Ocurrió un error al cargar los datos.';
  /** Muestra el botón "Reintentar" que emite `retry`. */
  @Input() showRetry = false;
  @Output() retry = new EventEmitter<void>();

  /**
   * Notifica al contenedor que el usuario pidió reintentar la carga fallida.
   */
  onRetry(): void {
    this.retry.emit();
  }
}
