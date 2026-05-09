import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { CartLine, SaleInstallmentOption } from '../../operation-form.service';
import { ProductRate } from '../../../../../features/admin/config/models/interfaces/product';

@Component({
  selector: 'app-step-conditions',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    CalendarModule,
    DropdownModule,
    InputNumberModule,
    MessageModule,
    CurrencyArsPipe,
  ],
  templateUrl: './step-conditions.component.html',
})
export class StepConditionsComponent {
  @Input() form!: FormGroup;
  @Input() cartLines: CartLine[] = [];
  @Input() paymentFrequencyOptions: { label: string; value: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' }[] = [];
  @Input() installmentsOptions: { label: string; value: number; frequency: string }[] = [];
  @Input() isInstallmentsRefreshing = false;
  @Input() capitalBase = 0;
  @Input() capitalAFinanciar = 0;
  @Input() interestRate = 0;
  @Input() valorCuota = 0;
  @Input() totalADevolver = 0;
  @Input() todayDate!: Date;
  @Input() installmentsDropdownClass = 'w-full';
  @Input() validatedDownPayment = 0;

  @Output() saleInstallmentsChanged = new EventEmitter<{ productoId: string; installments: number | null }>();

  /**
   * Opciones de cuotas para una línea del carrito según la frecuencia seleccionada.
   * @param {CartLine} line - Línea del carrito a evaluar.
   */
  getInstallmentsOptionsForLine(line: CartLine): SaleInstallmentOption[] {
    const selectedFrequency = this.form.controls['paymentFrequency']?.value as string | null;
    const formatFrequency = (f: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY') => {
      if (f === 'MONTHLY') return 'Mensual';
      if (f === 'BIWEEKLY') return 'Quincenal';
      return 'Semanal';
    };
    const unique = new Map<string, SaleInstallmentOption>();
    for (const rate of line.rates.filter(
      (r) => !selectedFrequency || r.paymentFrequency === selectedFrequency,
    )) {
      const key = `${rate.installmentsCount}-${rate.paymentFrequency}`;
      if (!unique.has(key)) {
        unique.set(key, {
          label: `${rate.installmentsCount} cuota${rate.installmentsCount > 1 ? 's' : ''} (${formatFrequency(rate.paymentFrequency)})`,
          value: rate.installmentsCount,
          frequency: rate.paymentFrequency,
        });
      }
    }
    return Array.from(unique.values()).sort((a, b) => a.value - b.value);
  }

  /**
   * Tasa seleccionada para una línea del carrito según cuotas y frecuencia del formulario.
   * @param {CartLine} line - Línea del carrito a evaluar.
   */
  private getSelectedRateForLine(line: CartLine): ProductRate | undefined {
    const selectedFrequency = this.form.controls['paymentFrequency']?.value as string | null;
    if (!line.selectedInstallments || !selectedFrequency) return undefined;
    return line.rates.find(
      (rate) =>
        rate.installmentsCount === line.selectedInstallments &&
        rate.paymentFrequency === selectedFrequency,
    );
  }

  private getLineDownPayment(line: CartLine): number {
    const totalCarrito = this.cartLines.reduce((acc, l) => acc + l.precio * l.cantidad, 0);
    if (this.validatedDownPayment <= 0 || totalCarrito <= 0) return 0;
    return (line.subtotal / totalCarrito) * this.validatedDownPayment;
  }

  private getLineFinancedCapital(line: CartLine): number {
    return Math.max(0, line.subtotal - this.getLineDownPayment(line));
  }

  /**
   * Valor de cuota de una línea con la fórmula oficial (redondeado al millar).
   * @param {CartLine} line - Línea del carrito a calcular.
   */
  getLineInstallmentValue(line: CartLine): number {
    const installments = line.selectedInstallments ?? 0;
    const rate = this.getSelectedRateForLine(line)?.rate ?? 0;
    if (installments <= 0) return 0;
    return Math.ceil((this.getLineFinancedCapital(line) * (1 + rate)) / installments / 1000) * 1000;
  }

  /**
   * Descripción corta del plan de cuotas por producto.
   * @param {CartLine} line - Línea del carrito en evaluación.
   */
  getLinePlanSubtitle(line: CartLine): string {
    const installments = line.selectedInstallments ?? 0;
    const money = (value: number) =>
      new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
      }).format(value);
    if (installments <= 0) return `${line.cantidad} u. · ${money(line.subtotal)} total`;
    return `${line.cantidad} u. · ${installments} cuota${installments > 1 ? 's' : ''} de ${money(this.getLineInstallmentValue(line))}`;
  }

  /**
   * Porcentaje de interés aplicado en una línea del carrito.
   * @param {CartLine} line - Línea del carrito a consultar.
   */
  getLineRatePercent(line: CartLine): number {
    const rate = this.getSelectedRateForLine(line)?.rate ?? 0;
    return Math.round(rate * 10000) / 100;
  }
}
