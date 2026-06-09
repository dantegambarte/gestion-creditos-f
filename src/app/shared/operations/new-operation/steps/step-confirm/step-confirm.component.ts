import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { SimulateResult } from '../../../../../features/seller/models/credit.model';
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
   * Resultado de la ultima simulacion del backend (paso 4). Si esta
   * presente, el cronograma del resumen lo usa tal cual — incluye la
   * regla de dia habil aplicada en backend (fines de semana + feriados).
   * Si no esta (raro, deberia estarlo siempre en paso 5), cae al
   * calculo local sin day-shift como fallback.
   */
  @Input() simulationResult: SimulateResult | null = null;

  /** Cuantas filas como maximo mostramos del cronograma en el resumen. */
  private static readonly SCHEDULE_PREVIEW_LIMIT = 4;

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
   * Expande las unidades serializadas del carrito para renderizarlas una por una
   * en el resumen lateral. Usa las unidades REALMENTE seleccionadas (en su orden
   * de selección), no las primeras del catálogo — sino el resumen mostraba un
   * IMEI distinto al que el usuario eligió.
   * @returns {{ title: string; unitCode: string }[]} Lista plana de unidades visibles.
   */
  get selectedUnitsSummary(): { title: string; unitCode: string }[] {
    return this.cartLines.flatMap((line) => {
      const baseTitle = `${line.nombre} ${this.getVariantLabel(line)}`.trim();
      const unitCodes = this.selectedUnitCodes(line);
      const codes = unitCodes.length ? unitCodes : ['-'];
      return codes.map((unitCode) => ({ title: baseTitle, unitCode }));
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

    const type = this.initialPaymentType;
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
   * Tipo de pago inicial seleccionado para adaptar etiquetas y montos del resumen.
   * @returns {'NONE' | 'DOWN_PAYMENT' | 'ADVANCED_INSTALLMENTS'} Tipo activo en el formulario.
   */
  get initialPaymentType(): 'NONE' | 'DOWN_PAYMENT' | 'ADVANCED_INSTALLMENTS' {
    const type = this.form?.controls['initialPaymentType']?.value;
    if (type === 'DOWN_PAYMENT' || type === 'ADVANCED_INSTALLMENTS') {
      return type;
    }
    return 'NONE';
  }

  /**
   * Etiqueta de negocio del pago inicial para el panel lateral.
   * @returns {string} Nombre del concepto a mostrar.
   */
  get initialPaymentLabel(): string {
    if (this.operationType !== 'SALE') return 'Detalle';
    if (this.initialPaymentType === 'DOWN_PAYMENT') return 'Enganche';
    if (this.initialPaymentType === 'ADVANCED_INSTALLMENTS')
      return 'Cuotas adelantadas';
    return 'Sin pago inicial';
  }

  /**
   * Monto total del pago inicial según el tipo elegido.
   * @returns {number} Importe que se descuenta del capital al inicio.
   */
  get initialPaymentAmount(): number {
    if (this.operationType !== 'SALE') return 0;
    if (this.initialPaymentType === 'DOWN_PAYMENT') {
      return Math.max(0, this.validatedDownPayment);
    }
    if (this.initialPaymentType === 'ADVANCED_INSTALLMENTS') {
      const count = Number(
        this.form?.controls['advancedInstallmentsCount']?.value ?? 0,
      );
      return Math.max(0, count) * Math.max(0, this.valorCuota);
    }
    return 0;
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
   * Construye un preview corto del cronograma. Si el backend ya devolvio
   * la simulacion del paso 4, la usamos: las fechas ya tienen aplicada
   * la regla de dia habil (fines de semana + feriados) y son las mismas
   * que se persistiran al aprobar. Si no hay simulacion (caso raro),
   * fallback al calculo local — sin day-shift, pero al menos no rompe.
   * @returns {{ label: string; dueDate: string; amount: number }[]} Primeras filas visibles del plan.
   */
  get schedulePreview(): { label: string; dueDate: string; amount: number }[] {
    const limit = StepConfirmComponent.SCHEDULE_PREVIEW_LIMIT;

    const backendSchedule = this.simulationResult?.schedule ?? [];
    if (backendSchedule.length > 0) {
      return backendSchedule.slice(0, limit).map((row) => ({
        label: `Cuota ${row.installmentNumber}`,
        dueDate: this.formatDate(this.parseLocalDate(row.dueDate)),
        amount: row.amount,
      }));
    }

    const firstPaymentDate = this.form?.controls['firstPaymentDate']
      ?.value as Date | null;
    const installments = this.summaryInstallmentsCount;
    if (!firstPaymentDate || installments <= 0 || this.valorCuota <= 0)
      return [];

    const rows = Math.min(installments, limit);
    return Array.from({ length: rows }).map((_, index) => ({
      label: `Cuota ${index + 1}`,
      dueDate: this.formatDate(
        this.addFrequencyToDate(firstPaymentDate, index),
      ),
      amount: this.valorCuota,
    }));
  }

  /**
   * Titulo dinamico del bloque de cronograma. Antes era hardcoded en
   * "primeras 4 cuotas" aunque el plan tuviera menos (o mas).
   */
  get schedulePreviewTitle(): string {
    const shown = this.schedulePreview.length;
    if (shown === 0) return 'Cronograma';
    const total = this.summaryInstallmentsCount;
    if (total > 0 && total <= shown) return `Cronograma (${total} cuota${total === 1 ? '' : 's'})`;
    return `Cronograma (primeras ${shown} cuotas)`;
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
    const codes = this.selectedUnitCodes(line);
    return codes.length ? codes.join(', ') : '-';
  }

  /**
   * Mapea selectedUnitIds de una línea a sus códigos (IMEI/serial) en el orden
   * de selección. Devuelve la lista real de unidades que se van a vender.
   */
  selectedUnitCodes(line: CartLine): string[] {
    return line.selectedUnitIds
      .map((id) => line.unitCodes[line.unitIds.indexOf(id)])
      .filter((code): code is string => !!code);
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
   * Parsea un string 'YYYY-MM-DD' como fecha local sin sesgo UTC.
   * new Date('YYYY-MM-DD') lo interpreta como medianoche UTC y en zonas
   * horarias negativas (AR GMT-3) muestra el dia anterior. Reconstruir
   * con componentes locales evita el drift.
   */
  private parseLocalDate(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) return new Date(value);
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
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

  /** Nombres de los checks de declaraciones (orden de aparicion en la UI). */
  private static readonly DECLARATION_FIELDS = [
    'chkIdentity', 'chkConditions', 'chkDisbursement', 'chkCapacity',
  ];

  /**
   * True si las 4 declaraciones estan tildadas. Habilita el modo "desmarcar"
   * del boton toggle (cambia label + color).
   */
  get allDeclarationsChecked(): boolean {
    if (!this.form) return false;
    return StepConfirmComponent.DECLARATION_FIELDS.every(
      (n) => !!this.form.controls[n]?.value,
    );
  }

  /**
   * Toggle: si todas estan tildadas las destilda, si no las tilda. Reemplaza
   * al setAllDeclarations(value) previo — un solo boton para ambos sentidos.
   */
  toggleAllDeclarations(): void {
    if (!this.form) return;
    const next = !this.allDeclarationsChecked;
    StepConfirmComponent.DECLARATION_FIELDS.forEach((n) => {
      if (this.form.controls[n]) {
        this.form.controls[n].setValue(next);
        this.form.controls[n].markAsDirty();
      }
    });
  }
}
