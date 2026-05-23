import { Directive, OnInit, inject } from '@angular/core';
import { InputNumber } from 'primeng/inputnumber';

/**
 * Unifica el comportamiento de inputs monetarios para evitar decimales fijos al editar.
 * Se aplica sobre p-inputNumber y fuerza un mínimo de 0 decimales visibles.
 */
@Directive({
  selector: 'p-inputNumber[appCurrencyAmountInput]',
  standalone: true,
})
export class CurrencyAmountInputDirective implements OnInit {
  private readonly inputNumber = inject(InputNumber);

  /**
   * Configura el input para no autocompletar ",00" cuando el usuario edita montos.
   */
  ngOnInit(): void {
    this.inputNumber.minFractionDigits = 0;
  }
}
