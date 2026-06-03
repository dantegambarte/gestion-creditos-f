import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { catchError, of } from 'rxjs';
import { AppError } from '../../../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { CashRegisterService } from '../../../../admin/cash-register/cash-register.service';
import { CreditDetail, EarlySettlementResult } from '../../../models/credit.model';
import { CreditsService } from '../../credits.service';

@Component({
  selector: 'app-settlement-dialog',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyArsPipe,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    TooltipModule,
  ],
  templateUrl: './settlement-dialog.component.html',
})
export class SettlementDialogComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() credit: CreditDetail | null = null;
  @Input() hasPendingPayments = false;
  @Input() settlementTotalAmount = 0;
  /** Se emite cuando la cancelación fue procesada; el padre debe recargar. */
  @Output() settled = new EventEmitter<void>();

  paymentMethod: 'CASH' | 'TRANSFER' = 'CASH';
  transferRef = '';
  processing = false;

  readonly PAYMENT_METHOD_OPTIONS = [
    { label: 'Efectivo', value: 'CASH' },
    { label: 'Transferencia', value: 'TRANSFER' },
  ];

  private readonly creditsSvc = inject(CreditsService);
  private readonly cashRegisterSvc = inject(CashRegisterService);
  private readonly msg = inject(MessageService);

  close(): void {
    this.visibleChange.emit(false);
  }

  /**
   * Verifica caja en tiempo real antes de procesar para evitar cancelaciones con caja cerrada.
   */
  confirm(): void {
    if (!this.credit) return;

    if (this.hasPendingPayments) {
      this.msg.add({
        severity: 'error',
        summary: 'Pagos Pendientes',
        detail:
          'Este crédito tiene pagos pendientes de aprobación. Resuelvalos antes de cancelar.',
        life: 5000,
      });
      return;
    }

    this.processing = true;
    this.cashRegisterSvc
      .getDashboard()
      .pipe(catchError(() => of(null)))
      .subscribe((dashboard) => {
        if (dashboard?.isClosed) {
          this.processing = false;
          this.msg.add({
            severity: 'error',
            summary: 'Caja Cerrada',
            detail:
              'No puedes cancelar créditos. La caja del día está CERRADA.',
            life: 5000,
          });
          return;
        }
        this.processSettlement();
      });
  }

  private processSettlement(): void {
    if (!this.credit) return;
    const payload = {
      paymentMethod: this.paymentMethod,
      ...(this.paymentMethod === 'TRANSFER' && this.transferRef
        ? { transferReference: this.transferRef }
        : {}),
    };

    this.creditsSvc.earlySettlement(this.credit.id, payload).subscribe({
      next: (result: EarlySettlementResult) => {
        this.processing = false;
        this.close();
        this.msg.add({
          severity: 'success',
          summary: 'Cancelación anticipada creada',
          detail: `Monto: $${result.settlementAmount}`,
          life: 6000,
        });
        this.settled.emit();
      },
      error: (err: AppError) => {
        this.processing = false;
        this.msg.add({
          severity: err.status === 409 ? 'warn' : 'error',
          summary: err.status === 409 ? 'Advertencia' : 'Error',
          detail: err.message ?? 'No se pudo procesar.',
        });
      },
    });
  }
}
