import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { SimulateResult } from '../../../models/credit.model';

@Component({
  selector: 'app-credit-simulation',
  standalone: true,
  imports: [ButtonModule, CurrencyArsPipe],
  templateUrl: './credit-simulation.component.html',
})
export class CreditSimulationComponent {
  @Input() result: SimulateResult | null = null;
  @Input() error: string | null = null;
  @Input() simulating = false;
  /** Emite cuando el usuario presiona "Simular". */
  @Output() simulate = new EventEmitter<void>();
}
