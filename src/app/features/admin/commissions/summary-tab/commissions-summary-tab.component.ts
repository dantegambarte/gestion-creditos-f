import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { AppError } from '../../../../core/models/app-error';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import {
  Liquidation,
  PaymentMethod,
  WeeklySummaryEmployee,
} from '../../models/commission.model';

@Component({
  selector: 'app-commissions-summary-tab',
  standalone: true,
  imports: [
    ButtonModule,
    CardModule,
    TableModule,
    TagModule,
    TooltipModule,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  templateUrl: './commissions-summary-tab.component.html',
})
export class CommissionsSummaryTabComponent {
  @Input() loadingSummary = false;
  @Input() errorSummary: AppError | null = null;
  @Input() employees: WeeklySummaryEmployee[] = [];
  @Input() loadingLiquidations = false;
  @Input() recentLiquidations: Liquidation[] = [];
  @Input() roleLabel!: (role: string) => string;
  @Input() roleTagClass!: (role: string) => string;
  @Input() rowDisabled!: (emp: WeeklySummaryEmployee) => boolean;
  @Input() formatCurrency!: (value: number) => string;
  @Input() formatDate!: (iso: string) => string;
  @Input() paymentMethodLabel!: (pm: PaymentMethod) => string;

  @Output() reloadSummary = new EventEmitter<void>();
  @Output() liquidate = new EventEmitter<WeeklySummaryEmployee>();

  /**
   * Emite el evento para refrescar el resumen semanal.
   */
  triggerReloadSummary(): void {
    this.reloadSummary.emit();
  }

  /**
   * Emite el empleado seleccionado para abrir el flujo de liquidación.
   * @param employee
   */
  triggerLiquidate(employee: WeeklySummaryEmployee): void {
    this.liquidate.emit(employee);
  }
}
