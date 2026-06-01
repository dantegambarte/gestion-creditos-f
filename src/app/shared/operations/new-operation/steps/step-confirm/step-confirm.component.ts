import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { ClientOperation } from '../../../../models/interface/client';
import { CartLine } from '../../operation-form.service';

@Component({
  selector: 'app-step-confirm',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CheckboxModule,
    MessageModule,
    CurrencyArsPipe,
  ],
  templateUrl: './step-confirm.component.html',
})
export class StepConfirmComponent {
  @Input() form!: FormGroup;
  @Input() selectedClient: ClientOperation | null = null;
  @Input() cartLines: CartLine[] = [];
  @Input() capitalAFinanciar = 0;
  @Input() valorCuota = 0;
  @Input() totalADevolver = 0;
  @Input() validatedDownPayment = 0;
  @Input() installmentsCount: number | null = null;

  /**
   * Expone el tipo de operación actual de forma segura para la vista.
   * @returns {'SALE' | 'LOAN'} Tipo de operación normalizado.
   */
  get operationType(): 'SALE' | 'LOAN' {
    return this.form?.controls['operationType']?.value === 'SALE'
      ? 'SALE'
      : 'LOAN';
  }

  /**
   * Obtiene la inicial del cliente para mostrarla en el avatar de resumen.
   * @returns {string} Inicial en mayúscula o "?" si no hay cliente.
   */
  get clientInitial(): string {
    const name = this.selectedClient?.name?.trim();
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  /**
   * Calcula intereses como diferencia positiva entre total y capital.
   * @returns {number} Monto de intereses nunca negativo.
   */
  get intereses(): number {
    return Math.max(this.totalADevolver - this.capitalAFinanciar, 0);
  }

  /**
   * Calcula el subtotal bruto de productos cargados antes del pago inicial.
   * @returns {number} Suma total de subtotales del carrito.
   */
  get subtotalProductos(): number {
    return this.cartLines.reduce(
      (acc, line) => acc + Number(line.subtotal ?? 0),
      0,
    );
  }

  /**
   * Cuenta las unidades totales incluidas en la operación actual.
   * @returns {number} Cantidad consolidada de unidades del carrito.
   */
  get totalUnitsCount(): number {
    return this.cartLines.reduce(
      (acc, line) => acc + Number(line.cantidad ?? 0),
      0,
    );
  }

  /**
   * Expande las unidades serializadas del carrito para renderizarlas una por una en el resumen lateral.
   * @returns {{ title: string; unitCode: string }[]} Lista plana de unidades visibles.
   */
  get selectedUnitsSummary(): { title: string; unitCode: string }[] {
    return this.cartLines.flatMap((line) => {
      const baseTitle = `${line.nombre} ${this.getVariantLabel(line)}`.trim();
      const unitCodes = line.unitCodes?.length
        ? line.unitCodes.slice(0, Math.max(1, Number(line.cantidad ?? 0)))
        : ['-'];
      return unitCodes.map((unitCode) => ({
        title: baseTitle,
        unitCode,
      }));
    });
  }

  /**
   * Devuelve la etiqueta comercial del tipo de operación actual.
   * @returns {string} Nombre legible del flujo actual.
   */
  get operationTypeLabel(): string {
    return this.operationType === 'SALE' ? 'Pre-venta' : 'Préstamo';
  }

  /**
   * Traduce la frecuencia seleccionada a una etiqueta visible.
   * @returns {string} Frecuencia legible o guion si falta dato.
   */
  get paymentFrequencyLabel(): string {
    const frequency = this.form?.controls['paymentFrequency']?.value;
    if (frequency === 'WEEKLY') return 'Semanal';
    if (frequency === 'BIWEEKLY') return 'Quincenal';
    if (frequency === 'MONTHLY') return 'Mensual';
    return '-';
  }

  /**
   * Expone la primera fecha de pago en formato local corto.
   * @returns {string} Fecha formateada o guion si no existe.
   */
  get firstPaymentDateLabel(): string {
    const date = this.form?.controls['firstPaymentDate']?.value as Date | null;
    return date ? this.formatDate(date) : '-';
  }

  /**
   * Resume el pago inicial aplicado según el tipo seleccionado.
   * @returns {string} Descripción compacta para el sidebar de resumen.
   */
  get initialPaymentSummary(): string {
    if (this.operationType !== 'SALE') return 'Sin pago inicial';

    const type = this.form?.controls['initialPaymentType']?.value;
    if (type === 'DOWN_PAYMENT' && this.validatedDownPayment > 0) {
      return `${this.formatCurrency(this.validatedDownPayment)} · ${this.paymentMethodLabel(this.form?.controls['downPaymentMethod']?.value)}`;
    }

    if (type === 'ADVANCED_INSTALLMENTS') {
      const count = Number(
        this.form?.controls['advancedInstallmentsCount']?.value ?? 0,
      );
      return `${count} cuota(s) · ${this.paymentMethodLabel(this.form?.controls['advancedInstallmentsMethod']?.value)}`;
    }

    return 'Sin pago inicial';
  }

  /**
   * Calcula la cantidad total de cuotas visibles para el resumen principal.
   * @returns {number} Número de cuotas globales del plan.
   */
  get summaryInstallmentsCount(): number {
    if (this.operationType === 'LOAN') {
      return Number(this.installmentsCount ?? 0);
    }

    return Math.max(
      0,
      ...this.cartLines.map((line) => Number(line.selectedInstallments ?? 0)),
    );
  }

  /**
   * Calcula una tasa promedio simple a partir del total y el capital financiado.
   * @returns {string} Porcentaje con coma decimal para mostrar en el resumen.
   */
  get averageRateLabel(): string {
    if (this.capitalAFinanciar <= 0 || this.intereses <= 0) return '0%';
    const percent = (this.intereses / this.capitalAFinanciar) * 100;
    return `${percent.toFixed(1).replace('.', ',')}%`;
  }

  /**
   * Construye un preview corto del cronograma usando la fecha inicial y la frecuencia actual.
   * @returns {{ label: string; dueDate: string; amount: number }[]} Primeras filas visibles del plan.
   */
  get schedulePreview(): { label: string; dueDate: string; amount: number }[] {
    const firstPaymentDate = this.form?.controls['firstPaymentDate']
      ?.value as Date | null;
    const installments = this.summaryInstallmentsCount;
    if (!firstPaymentDate || installments <= 0 || this.valorCuota <= 0)
      return [];

    const rows = Math.min(installments, 4);
    return Array.from({ length: rows }).map((_, index) => ({
      label: `Cuota ${index + 1}`,
      dueDate: this.formatDate(
        this.addFrequencyToDate(firstPaymentDate, index),
      ),
      amount: this.valorCuota,
    }));
  }

  /**
   * Informa si hay más cuotas que las visibles en el preview corto.
   * @returns {number} Cantidad restante luego de las primeras filas.
   */
  get hiddenInstallmentsCount(): number {
    return Math.max(
      this.summaryInstallmentsCount - this.schedulePreview.length,
      0,
    );
  }

  /**
   * Selecciona la tasa activa de una línea según cuotas y frecuencia actual.
   * @param {CartLine} line - Línea del carrito a inspeccionar.
   * @returns {number} Porcentaje de tasa para UI o 0 si no aplica.
   */
  getLineRatePercent(line: CartLine): number {
    const frequency = this.form?.controls['paymentFrequency']?.value;
    const selectedInstallments = Number(line.selectedInstallments ?? 0);
    const selectedRate = line.rates.find(
      (rate) =>
        rate.installmentsCount === selectedInstallments &&
        rate.paymentFrequency === frequency,
    );

    return selectedRate ? Number((selectedRate.rate * 100).toFixed(1)) : 0;
  }

  /**
   * Devuelve una etiqueta corta de la variante para la tabla de contribución.
   * @param {CartLine} line - Línea del carrito a resumir.
   * @returns {string} Variante visible o texto fallback.
   */
  getVariantLabel(line: CartLine): string {
    return line.variantLabel?.trim() || 'Estándar';
  }

  /**
   * Resume los IMEI/seriales visibles de una línea para el panel lateral.
   * @param {CartLine} line - Línea del carrito seleccionada.
   * @returns {string} Texto compacto con seriales o guion si no hay datos.
   */
  getUnitCodesLabel(line: CartLine): string {
    return line.unitCodes?.length ? line.unitCodes.join(', ') : '-';
  }

  /**
   * Resuelve el monto de cuota por línea usando valores disponibles de forma segura.
   * @param {CartLine} line - Línea del carrito a resumir.
   * @returns {number} Valor de cuota estimado para mostrar en la UI.
   */
  getCuotaPorLinea(line: CartLine): number {
    const cuotas = Number(line.selectedInstallments ?? 0);
    if (cuotas > 0 && line.subtotal > 0) {
      return line.subtotal / cuotas;
    }
    return 0;
  }

  /**
   * Formatea un importe en ARS sin depender del template.
   * @param {number} value - Monto a convertir.
   * @returns {string} Importe legible en formato local.
   */
  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  }

  /**
   * Traduce el método de pago a una etiqueta visible.
   * @param {string | null | undefined} value - Código interno del método.
   * @returns {string} Nombre comercial para la UI.
   */
  private paymentMethodLabel(value: string | null | undefined): string {
    return value === 'TRANSFER' ? 'Transferencia' : 'Efectivo';
  }

  /**
   * Formatea fechas en el estilo corto usado por el resumen final.
   * @param {Date} value - Fecha a presentar.
   * @returns {string} Fecha local dd/mm/yyyy.
   */
  private formatDate(value: Date): string {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(value);
  }

  /**
   * Avanza una fecha según la frecuencia de pago activa para construir el cronograma.
   * @param {Date} baseDate - Fecha de arranque del plan.
   * @param {number} index - Desplazamiento de cuota a calcular.
   * @returns {Date} Fecha resultante para la cuota indicada.
   */
  private addFrequencyToDate(baseDate: Date, index: number): Date {
    const frequency = this.form?.controls['paymentFrequency']?.value;
    const date = new Date(baseDate);

    if (frequency === 'WEEKLY') {
      date.setDate(date.getDate() + index * 7);
      return date;
    }

    if (frequency === 'BIWEEKLY') {
      date.setDate(date.getDate() + index * 14);
      return date;
    }

    date.setMonth(date.getMonth() + index);
    return date;
  }
}
