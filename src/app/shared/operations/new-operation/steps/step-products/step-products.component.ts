import { DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { ProductOperation } from '../../../../models/interface/product';
import { OperationFormService } from '../../operation-form.service';

@Component({
  selector: 'app-step-products',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    FormsModule,
    DecimalPipe,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    InputNumberModule,
    ButtonModule,
    DropdownModule,
    TagModule,
  ],
  templateUrl: './step-products.component.html',
})
export class StepProductsComponent {
  form = inject(OperationFormService);

  /**
   * Devuelve si la operación actual usa productos (solo venta a crédito).
   * @returns {boolean} true cuando corresponde mostrar y habilitar productos.
   */
  get usesProducts(): boolean {
    return this.form.selectedType() === 'SALE';
  }

  /**
   * Cambia el tipo de operación delegando la limpieza de estado al servicio.
   * @param {'SALE' | 'LOAN'} type - Tipo elegido por el usuario.
   */
  changeOperationType(type: 'SALE' | 'LOAN') {
    this.form.setOperationType(type);
  }

  /**
   * Indica si la unidad ya está seleccionada para evitar duplicados en la venta.
   * @param {string} productId - ID real de la unidad seleccionable.
   * @returns {boolean} true cuando la unidad ya fue agregada.
   */
  isProductSelected(productId: string): boolean {
    return this.form.isProductSelected(productId);
  }

  /**
   * Agrega una unidad al listado seleccionado del flujo de venta.
   * @param {ProductOperation} prod - Unidad elegida.
   */
  addProduct(prod: ProductOperation) {
    this.form.addProduct(prod);
  }

  /**
   * Quita una unidad del listado seleccionado del flujo de venta.
   * @param {ProductOperation} prod - Unidad a remover.
   */
  removeProduct(prod: ProductOperation) {
    this.form.removeProduct(prod);
  }
}
