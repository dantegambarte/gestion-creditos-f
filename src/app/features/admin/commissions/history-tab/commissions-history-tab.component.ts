import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Liquidation, PaymentMethod } from '../../models/commission.model';
import { FfBackTopFabComponent } from '../../../../shared/components/back-top-fab/ff-back-top-fab.component';

@Component({
  selector: 'app-commissions-history-tab',
  standalone: true,
  imports: [
    FormsModule,
    CardModule,
    DropdownModule,
    SkeletonModule,
    TableModule,
    TagModule,
    FfBackTopFabComponent,
  ],
  templateUrl: './commissions-history-tab.component.html',
})
export class CommissionsHistoryTabComponent {
  @Input() loadingLiquidations = false;
  @Input() historyRows: Liquidation[] = [];
  @Input() historyStats!: {
    totalPaid: number;
    totalCommissions: number;
    totalSalary: number;
    count: number;
  };
  @Input() selectedHistory: Liquidation | null = null;
  @Input() historyEmployeeFilter = 'ALL';
  @Input() historyEmployeeOptions: { label: string; value: string }[] = [];
  @Input() historyMethodFilter: 'ALL' | PaymentMethod = 'ALL';
  @Input() historyMethodOptions: {
    label: string;
    value: 'ALL' | PaymentMethod;
  }[] = [];
  @Input() roleByUserId!: (userId: string) => string;
  @Input() roleClassByUserId!: (userId: string) => string;
  @Input() formatCurrency!: (value: number) => string;
  @Input() formatDate!: (iso: string) => string;
  @Input() paymentMethodLabel!: (pm: PaymentMethod) => string;

  @Output() historyEmployeeFilterChange = new EventEmitter<string>();
  @Output() historyMethodFilterChange = new EventEmitter<
    'ALL' | PaymentMethod
  >();
  @Output() historySelected = new EventEmitter<Liquidation>();
  @Output() historyCleared = new EventEmitter<void>();

  /**
   * Sincroniza el filtro por empleado con el componente padre.
   * @param value
   */
  onHistoryEmployeeFilterChange(value: string): void {
    this.historyEmployeeFilterChange.emit(value);
  }

  /**
   * Sincroniza el filtro por método con el componente padre.
   * @param value
   */
  onHistoryMethodFilterChange(value: 'ALL' | PaymentMethod): void {
    this.historyMethodFilterChange.emit(value);
  }

  /**
   * Emite la liquidación seleccionada para mostrar detalle lateral.
   * @param liq
   */
  onSelectHistory(liq: Liquidation): void {
    this.historySelected.emit(liq);
  }

  /**
   * Notifica al padre que se debe cerrar el panel de detalle.
   */
  clearHistorySelection(): void {
    this.historyCleared.emit();
  }
}
