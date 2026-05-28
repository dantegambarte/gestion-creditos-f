import { Directive, HostListener, OnInit, inject } from '@angular/core';
import { InputNumber } from 'primeng/inputnumber';

/**
 * Unifica el comportamiento de inputs monetarios para evitar decimales fijos al editar.
 * Se aplica sobre p-inputNumber y fuerza un mínimo de 0 decimales visibles.
 * Bloquea teclas inválidas (e, E, +) que p-inputNumber puede dejar pasar en algunos browsers.
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

  /**
   * Bloquea teclas inválidas para montos monetarios.
   * 'e'/'E' son válidos en input[type=number] (notación científica) pero no en montos.
   */
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'e' || event.key === 'E' || event.key === '+') {
      event.stopPropagation();
      event.preventDefault();
    }
  }
}
