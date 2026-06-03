import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [ButtonModule],
  template: `
    <p-button
      label="Volver"
      icon="pi pi-arrow-left"
      severity="secondary"
      [outlined]="true"
      [attr.data-cy]="dataCy || null"
      (onClick)="back.emit()"
    />
  `,
  styles: [
    `
      :host {
        display: block;
        margin-bottom: 1rem;
      }
    `,
  ],
})
export class BackButtonComponent {
  /** Selector para tests e2e. Opcional. */
  @Input() dataCy?: string;

  /** Emite cuando el usuario hace click. La navegación es responsabilidad del padre. */
  @Output() back = new EventEmitter<void>();
}
