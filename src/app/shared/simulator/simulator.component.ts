import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiHttpService } from '../../core/http/api-http.service';
import { CurrencyArsPipe } from '../../core/pipes/currency-ars.pipe';
import { AppError } from '../../core/models/app-error';
import { HeaderService } from '../../core/services/header.service';
import { SimulateResult } from '../../features/seller/models/credit.model';

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY:  'Mensual',
  BIWEEKLY: 'Quincenal',
  WEEKLY:   'Semanal',
};

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

interface DropdownOption<T> { label: string; value: T; }

@Component({
  selector: 'app-simulator',
  standalone: true,
  imports: [FormsModule, ButtonModule, DropdownModule, InputNumberModule, SkeletonModule, CurrencyArsPipe],
  templateUrl: './simulator.component.html',
})
export class SimulatorComponent implements OnInit {
  private readonly api    = inject(ApiHttpService);
  private readonly header = inject(HeaderService);

  // Estado de carga de opciones
  loadingOptions = true;
  optionsError = '';

  // Mapa { MONTHLY: [6, 12, 24], WEEKLY: [4, 8], ... }
  private optionsByFrequency: Record<string, number[]> = {};

  frequencyOptions: DropdownOption<string>[]   = [];
  installmentOptions: DropdownOption<number>[] = [];

  // Valores del formulario
  amount: number | null = null;
  frequency = '';
  installments = 0;

  // Estado de simulación
  simulating = false;
  result: SimulateResult | null = null;
  error = '';

  ngOnInit(): void {
    this.header.set([{ label: 'Simulador' }]);
    this.loadOptions();
  }

  private loadOptions(): void {
    this.api
      .get<Record<string, number[]>>('credits/simulate/options')
      .subscribe({
        next: (data) => {
          this.optionsByFrequency = data;
          this.frequencyOptions = Object.keys(data).map(f => ({
            label: FREQUENCY_LABELS[f] ?? f,
            value: f,
          }));
          if (this.frequencyOptions.length > 0) {
            this.frequency = this.frequencyOptions[0].value;
            this.updateInstallmentOptions();
          }
          this.loadingOptions = false;
        },
        error: () => {
          this.optionsError = 'No se pudieron cargar las opciones de cuotas.';
          this.loadingOptions = false;
        },
      });
  }

  onFrequencyChange(): void {
    this.result = null;
    this.error = '';
    this.updateInstallmentOptions();
  }

  private updateInstallmentOptions(): void {
    const counts = this.optionsByFrequency[this.frequency] ?? [];
    this.installmentOptions = counts.map(n => ({ label: `${n} cuotas`, value: n }));
    this.installments = counts[0] ?? 0;
  }

  simulate(): void {
    if (!this.amount || this.amount <= 0 || !this.frequency || !this.installments) return;

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
          this.result     = res;
          this.simulating = false;
        },
        error: (err: AppError) => {
          this.error      = err.message ?? 'No se pudo realizar la simulación.';
          this.simulating = false;
        },
      });
  }

  get frequencyLabel(): string {
    return this.frequencyOptions.find(f => f.value === this.frequency)?.label ?? '';
  }

  get hasOptions(): boolean {
    return this.frequencyOptions.length > 0;
  }
}
