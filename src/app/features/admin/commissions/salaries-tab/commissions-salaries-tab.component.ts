import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FfBackTopFabComponent } from './../../../../shared/components/back-top-fab/ff-back-top-fab.component';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { CurrencyAmountInputDirective } from '../../../../shared/directives/currency-amount-input.directive';
import { Salary } from '../../models/commission.model';

type SalaryRow = {
  userId: string;
  fullName: string;
  role: string;
  weeklyAmount: number;
};

@Component({
  selector: 'app-commissions-salaries-tab',
  standalone: true,
  imports: [
    FfBackTopFabComponent,
    FormsModule,
    ButtonModule,
    CardModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    TableModule,
    TagModule,
    CurrencyAmountInputDirective,
  ],
  templateUrl: './commissions-salaries-tab.component.html',
})
export class CommissionsSalariesTabComponent {
  @Input() salaryStats!: {
    collectors: number;
    configured: number;
    weeklyTotal: number;
  };
  @Input() salarySearchTerm = '';
  @Input() filteredSalaryRows: SalaryRow[] = [];
  @Input() selectedCollectorId: string | null = null;
  @Input() collectorOptions: { label: string; value: string }[] = [];
  @Input() loadingSalary = false;
  @Input() currentSalary: Salary | null = null;
  @Input() newWeeklyAmount: number | null = null;
  @Input() savingSalary = false;
  @Input() roleLabel!: (role: string) => string;
  @Input() roleTagClass!: (role: string) => string;
  @Input() formatCurrency!: (value: number) => string;

  @Output() salarySearchTermChange = new EventEmitter<string>();
  @Output() selectedCollectorIdChange = new EventEmitter<string | null>();
  @Output() collectorChanged = new EventEmitter<void>();
  @Output() collectorRowSelected = new EventEmitter<string>();
  @Output() newWeeklyAmountChange = new EventEmitter<number | null>();
  @Output() salarySaved = new EventEmitter<void>();

  /**
   * Sincroniza el texto de búsqueda con el componente padre.
   * @param value
   */
  onSalarySearchTermChange(value: string): void {
    this.salarySearchTermChange.emit(value);
  }

  /**
   * Sincroniza el cobrador seleccionado en el dropdown y dispara carga de sueldo.
   * @param value
   */
  onSelectedCollectorChange(value: string | null): void {
    this.selectedCollectorIdChange.emit(value);
    this.collectorChanged.emit();
  }

  /**
   * Emite la selección de cobrador desde la tabla para edición directa.
   * @param userId
   */
  onSelectCollectorRow(userId: string): void {
    this.collectorRowSelected.emit(userId);
  }

  /**
   * Sincroniza el monto semanal editado con el estado del padre.
   * @param value
   */
  onWeeklyAmountChange(value: number | null): void {
    this.newWeeklyAmountChange.emit(value);
  }

  /**
   * Emite la acción de guardado del sueldo semanal.
   */
  onSaveSalary(): void {
    this.salarySaved.emit();
  }
}
