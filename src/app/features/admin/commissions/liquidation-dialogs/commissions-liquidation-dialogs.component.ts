import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import {
  Commission,
  PaymentMethod,
  WeeklySummaryEmployee,
} from '../../models/commission.model';

@Component({
  selector: 'app-commissions-liquidation-dialogs',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    TableModule,
  ],
  templateUrl: './commissions-liquidation-dialogs.component.html',
})
export class CommissionsLiquidationDialogsComponent {
  @Input() showLiquidateDialog = false;
  @Input() showConfirmDialog = false;
  @Input() selectedEmployee: WeeklySummaryEmployee | null = null;
  @Input() liquidating = false;
  @Input() liquidatePaymentMethod: PaymentMethod = 'CASH';
  @Input() liquidateTransferReference = '';
  @Input() paymentMethodOptions: Array<{
    label: string;
    value: PaymentMethod;
  }> = [];
  @Input() formatCurrency!: (value: number) => string;
  @Input() employeeCommissions: Commission[] = [];
  @Input() loadingCommissions = false;

  @Output() showLiquidateDialogChange = new EventEmitter<boolean>();
  @Output() showConfirmDialogChange = new EventEmitter<boolean>();
  @Output() liquidatePaymentMethodChange = new EventEmitter<PaymentMethod>();
  @Output() liquidateTransferReferenceChange = new EventEmitter<string>();
  @Output() openConfirm = new EventEmitter<void>();
  @Output() confirmLiquidate = new EventEmitter<void>();

  /**
   * Cierra el diálogo de liquidación principal.
   */
  closeLiquidateDialog(): void {
    this.showLiquidateDialogChange.emit(false);
  }

  /**
   * Cierra el diálogo de confirmación.
   */
  closeConfirmDialog(): void {
    this.showConfirmDialogChange.emit(false);
  }

  /**
   * Propaga el cambio de método de pago hacia el componente padre.
   * @param value
   */
  onPaymentMethodChange(value: PaymentMethod): void {
    this.liquidatePaymentMethodChange.emit(value);
  }

  /**
   * Propaga la referencia de transferencia hacia el componente padre.
   * @param value
   */
  onTransferReferenceChange(value: string): void {
    this.liquidateTransferReferenceChange.emit(value);
  }

  /**
   * Solicita abrir el diálogo de confirmación antes de liquidar.
   */
  requestOpenConfirm(): void {
    this.openConfirm.emit();
  }

  /**
   * Solicita la ejecución final de la liquidación.
   */
  requestConfirmLiquidate(): void {
    this.confirmLiquidate.emit();
  }
}
