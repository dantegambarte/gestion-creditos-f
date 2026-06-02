import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { Payment } from '../../../models/interface/dashboard';

@Component({
  selector: 'app-dashboard-approve-payment-dialog',
  standalone: true,
  imports: [DialogModule, ButtonModule, CurrencyArsPipe],
  templateUrl: './dashboard-approve-payment-dialog.component.html',
})
export class DashboardApprovePaymentDialogComponent {
  @Input() visible = false;
  @Input() payment: Payment | null = null;
  @Input() processing = false;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  /**
   * Cierra el modal y notifica cancelación al componente padre.
   */
  cancel(): void {
    this.visibleChange.emit(false);
    this.cancelled.emit();
  }

  /**
   * Emite la confirmación final para ejecutar la aprobación del cobro.
   */
  confirm(): void {
    this.confirmed.emit();
  }
}
