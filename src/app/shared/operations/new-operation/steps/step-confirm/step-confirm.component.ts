import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { OperationFormService } from '../../operation-form.service';

@Component({
  selector: 'app-step-confirm',
  standalone: true,
  imports: [CurrencyArsPipe, DatePipe, FormsModule, CheckboxModule],
  templateUrl: './step-confirm.component.html',
})
export class StepConfirmComponent {
  form = inject(OperationFormService);

  /**
   * Obtiene iniciales simples para avatar del cliente en el resumen.
   * @param {string | undefined} name - Nombre completo del cliente.
   * @returns {string} Hasta dos iniciales en orden.
   */
  initials(name: string | undefined): string {
    if (!name) return '';
    const parts = name.split(' ');
    return (parts[0]?.charAt(0) ?? '') + (parts[1]?.charAt(0) ?? '');
  }

  /**
   * Devuelve una etiqueta legible del tipo de operación para el paso 4.
   * @returns {string} Texto corto para distinguir venta y préstamo.
   */
  operationTypeLabel(): string {
    return this.form.selectedType() === 'SALE'
      ? 'Venta a Crédito'
      : 'Préstamo Personal';
  }

  /**
   * Arma una descripción compacta del plan de cuotas según el tipo.
   * @returns {string} Cantidad de cuotas y frecuencia cuando aplica.
   */
  installmentsLabel(): string {
    const installments = this.form.installmentsCount();

    if (this.form.selectedType() === 'SALE') {
      return `${installments} cuotas`;
    }

    const frequencyLabel = this.form.selectedFrequency().label.split(' ')[0];
    return `${installments} cuotas (${frequencyLabel.toLowerCase()})`;
  }

  updateCheck(
    key: 'identity' | 'conditions' | 'disbursement' | 'capacity',
    value: boolean,
  ) {
    this.form.updateCheck(key, value);
  }
}
