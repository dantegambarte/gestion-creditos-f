import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { ApiHttpService } from '../../core/http/api-http.service';
import { CurrencyArsPipe } from '../../core/pipes/currency-ars.pipe';
import { AppError } from '../../core/models/app-error';
import { HeaderService } from '../../core/services/header.service';
import { SimulateResult } from '../../features/seller/models/credit.model';

function toResult(raw: Record<string, unknown>): SimulateResult {
  const items = Array.isArray(raw['items']) ? raw['items'] : [];
  return {
    type:               raw['type'] as string,
    paymentFrequency:   raw['payment_frequency'] as string,
    installmentsCount:  raw['installments_count'] as number,
    totalAmount:        raw['total_amount'] as number,
    installmentAmount:  raw['installment_amount'] as number,
    totalToReturn:      raw['total_to_return'] as number,
    financedAmount:     (raw['financed_amount'] as number) ?? (raw['total_amount'] as number),
    downPayment:        (raw['down_payment'] as number) ?? 0,
    note:               (raw['note'] as string) ?? '',
    items:              items.map((i: Record<string, unknown>) => ({
      productId:               i['product_id'] as string,
      productName:             i['product_name'] as string,
      quantity:                i['quantity'] as number,
      unitPrice:               i['unit_price'] as number,
      lineTotal:               i['line_total'] as number,
      rate:                    i['rate'] as number,
      installmentContribution: i['installment_contribution'] as number,
    })),
  };
}

interface FrequencyOption  { label: string; value: string; }
interface InstallmentOption { label: string; value: number; }

@Component({
  selector: 'app-simulator',
  standalone: true,
  imports: [FormsModule, ButtonModule, DropdownModule, InputNumberModule, CurrencyArsPipe],
  templateUrl: './simulator.component.html',
})
export class SimulatorComponent implements OnInit {
  private readonly api    = inject(ApiHttpService);
  private readonly header = inject(HeaderService);

  ngOnInit(): void {
    this.header.set([{ label: 'Simulador' }]);
  }

  amount: number | null = null;
  installments = 12;
  frequency = 'MONTHLY';
  simulating = false;
  result: SimulateResult | null = null;
  error = '';

  readonly frequencyOptions: FrequencyOption[] = [
    { label: 'Mensual',   value: 'MONTHLY'  },
    { label: 'Quincenal', value: 'BIWEEKLY' },
    { label: 'Semanal',   value: 'WEEKLY'   },
  ];

  readonly installmentOptions: InstallmentOption[] = [3, 6, 9, 12, 18, 24].map(n => ({
    label: `${n} cuotas`,
    value: n,
  }));

  simulate(): void {
    if (!this.amount || this.amount <= 0) return;

    this.simulating = true;
    this.result = null;
    this.error = '';

    this.api
      .post<Record<string, unknown>>('credits/simulate', {
        type:               'LOAN',
        total_amount:       this.amount,
        installments_count: this.installments,
        payment_frequency:  this.frequency,
      })
      .pipe(map(toResult))
      .subscribe({
        next: (res) => {
          this.result    = res;
          this.simulating = false;
        },
        error: (err: AppError) => {
          this.error     = err.message ?? 'No se pudo realizar la simulación.';
          this.simulating = false;
        },
      });
  }

  get frequencyLabel(): string {
    return this.frequencyOptions.find(f => f.value === this.frequency)?.label ?? '';
  }
}
