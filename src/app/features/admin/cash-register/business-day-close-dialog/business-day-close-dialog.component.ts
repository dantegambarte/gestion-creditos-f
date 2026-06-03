import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { finalize } from 'rxjs/operators';
import { CashRegisterService } from '../cash-register.service';

/**
 * F3: dialog para el cierre formal de jornada (READY_TO_CLOSE → CLOSED).
 *
 * El padre solo lo abre cuando:
 *   · La jornada está en READY_TO_CLOSE
 *   · No hay cajas OPEN ni PENDING_RECONCILIATION
 *
 * Force-close (jornadas trabadas con cajas pendientes) NO se ofrece acá —
 * queda como herramienta administrativa de excepción accesible vía backend.
 */
@Component({
  selector: 'app-business-day-close-dialog',
  standalone: true,
  imports: [FormsModule, ButtonModule, DialogModule, InputTextareaModule],
  templateUrl: './business-day-close-dialog.component.html',
})
export class BusinessDayCloseDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() businessDayId: string | null = null;
  @Input() businessDate: string | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() closedSuccessfully = new EventEmitter<void>();

  private readonly service = inject(CashRegisterService);
  private readonly msg = inject(MessageService);

  observations = '';
  submitting = false;
  errorMessage: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.observations = '';
      this.errorMessage = null;
      this.submitting = false;
    }
  }

  canSubmit(): boolean {
    return !this.submitting && !!this.businessDayId;
  }

  submit(): void {
    if (!this.canSubmit() || !this.businessDayId) return;
    this.submitting = true;
    this.errorMessage = null;

    this.service
      .closeBusinessDay(this.businessDayId, this.observations.trim() || undefined)
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: () => {
          this.msg.add({
            severity: 'success',
            summary: 'Jornada cerrada',
            detail: this.businessDate
              ? `Jornada del ${this.formatDate(this.businessDate)} cerrada formalmente.`
              : 'Jornada cerrada formalmente.',
          });
          this.closedSuccessfully.emit();
          this.close();
        },
        error: (err) => {
          this.errorMessage = err?.message || 'No se pudo cerrar la jornada.';
        },
      });
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  formatDate(iso: string): string {
    const d = iso.split('T')[0].split('-');
    return `${d[2]}/${d[1]}/${d[0]}`;
  }
}
