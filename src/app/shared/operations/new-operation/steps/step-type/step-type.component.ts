import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-step-type',
  standalone: true,
  templateUrl: './step-type.component.html',
})
export class StepTypeComponent {
  @Input() selectedType: 'SALE' | 'LOAN' | null = null;
  @Output() typeSelected = new EventEmitter<'SALE' | 'LOAN'>();

  readonly operationTypeCards = [
    {
      label: 'Venta de Productos',
      description: 'Seleccioná productos del catálogo y armá el carrito.',
      value: 'SALE' as const,
      icon: 'pi pi-shopping-bag',
      dataCy: 'btn-operation-type-sale',
    },
    {
      label: 'Préstamo Efectivo',
      description: 'Definí el monto y las condiciones del préstamo.',
      value: 'LOAN' as const,
      icon: 'pi pi-wallet',
      dataCy: 'btn-operation-type-loan',
    },
  ];

  /**
   * Emite el tipo elegido para sincronizar el formulario del smart component.
   * @param {'SALE' | 'LOAN'} type - Tipo de operación seleccionado en la tarjeta.
   */
  selectType(type: 'SALE' | 'LOAN'): void {
    this.typeSelected.emit(type);
  }
}
