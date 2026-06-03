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
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { finalize } from 'rxjs/operators';
import { CurrencyAmountInputDirective } from '../../../../shared/directives/currency-amount-input.directive';
import { CashSession } from '../../models/cash-session.model';
import { CashRegisterService } from '../cash-register.service';

/**
 * V4: dialog de apertura de caja operativa de la jornada. Form simple con
 * opening_amount (obligatorio) + shift_label opcional + observations opcional.
 */
@Component({
  selector: 'app-cash-session-open-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    InputTextareaModule,
    CurrencyAmountInputDirective,
  ],
  templateUrl: './cash-session-open-dialog.component.html',
})
export class CashSessionOpenDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() openedSuccessfully = new EventEmitter<CashSession>();

  private readonly service = inject(CashRegisterService);
  private readonly msg = inject(MessageService);

  openingAmount: number | null = null;
  shiftLabel = '';
  observations = '';
  submitting = false;
  errorMessage: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.openingAmount = null;
    this.shiftLabel = '';
    this.observations = '';
    this.errorMessage = null;
    this.submitting = false;
  }

  canSubmit(): boolean {
    return this.openingAmount != null && this.openingAmount >= 0 && !this.submitting;
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.submitting = true;
    this.errorMessage = null;

    this.service
      .openSession({
        opening_amount: this.openingAmount!,
        shift_label:    this.shiftLabel.trim() || undefined,
        observations:   this.observations.trim() || undefined,
      })
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: (session) => {
          this.msg.add({
            severity: 'success',
            summary: 'Caja abierta',
            detail: `Caja operativa #${session.id.slice(0, 8)} abierta correctamente.`,
          });
          this.openedSuccessfully.emit(session);
          this.close();
        },
        error: (err) => {
          this.errorMessage = err?.message || 'No se pudo abrir la caja.';
        },
      });
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
