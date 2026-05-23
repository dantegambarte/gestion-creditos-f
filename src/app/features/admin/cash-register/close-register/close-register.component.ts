import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
} from '@angular/core';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { CurrencyAmountInputDirective } from '../../../../shared/directives/currency-amount-input.directive';

export interface CloseRegisterData {
  date: string;
  shift: string;
  totalIncome: number;
  incomeTransactions: number;
  totalExpenses: number;
  expenseTransactions: number;
  expectedBalance: number;
  breakdown: { label: string; icon: string; amount: number }[];
}

@Component({
  selector: 'app-close-register',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextareaModule,
    InputNumberModule,
    CurrencyAmountInputDirective,
  ],
  templateUrl: './close-register.component.html',
  styleUrl: './close-register.component.scss',
})
export class CloseRegisterComponent implements OnChanges {
  @Input() visible = false;
  @Input() data!: CloseRegisterData;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() onClose = new EventEmitter<{
    countedCash: number;
    observations: string;
  }>();

  countedCash: number | null = null;
  observations = '';

  ngOnChanges(): void {
    if (this.visible) {
      this.countedCash = null;
      this.observations = '';
    }
  }

  /**
   * Calcula la diferencia entre el efectivo contado y el balance esperado, y determina si el conteo es exacto o no.
   */
  get difference(): number {
    if (this.countedCash === null) return 0;
    return this.countedCash - (this.data?.expectedBalance ?? 0);
  }

  /**
   * Indica si el efectivo contado coincide exactamente con el balance esperado, lo que significa que no hay diferencia. Si la diferencia es cero, se considera un conteo exacto; de lo contrario, se muestra la cantidad de diferencia, ya sea un sobrante (positivo) o un faltante (negativo).
   */
  get isExact(): boolean {
    return this.difference === 0;
  }

  /**
   * Cierra el modal de cierre de caja sin guardar cambios, emitiendo un evento para notificar al componente padre que el modal ha sido cerrado. Esto permite que el usuario cancele el proceso de cierre de caja si decide no continuar, manteniendo la información actual sin modificaciones.
   */
  cancel(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  /**
   * Confirma el cierre de caja, emitiendo un evento con los datos del efectivo contado y las observaciones ingresadas por el usuario. Luego, cierra el modal y notifica al componente padre que el proceso de cierre ha sido completado, permitiendo que se realicen las acciones necesarias para finalizar el cierre de caja, como guardar la información o actualizar el estado del sistema.
   */
  confirm(): void {
    this.onClose.emit({
      countedCash: this.countedCash ?? 0,
      observations: this.observations,
    });
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
