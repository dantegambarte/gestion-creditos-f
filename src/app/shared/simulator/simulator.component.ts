import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LowerCasePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiHttpService } from '../../core/http/api-http.service';
import { CurrencyArsPipe } from '../../core/pipes/currency-ars.pipe';
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

export interface SimulateOption {
  frequency: string;
  frequencyLabel: string;
  installments: number;
  result: SimulateResult;
}

export interface FrequencyGroup {
  frequency: string;
  label: string;
  options: SimulateOption[];
}

@Component({
  selector: 'app-simulator',
  standalone: true,
  imports: [FormsModule, LowerCasePipe, ButtonModule, InputNumberModule, SkeletonModule, CurrencyArsPipe],
  templateUrl: './simulator.component.html',
})
export class SimulatorComponent implements OnInit {
  private readonly api    = inject(ApiHttpService);
  private readonly header = inject(HeaderService);

  loadingOptions = true;
  optionsError = '';
  private optionsByFrequency: Record<string, number[]> = {};

  step: 1 | 2 | 3 = 1;

  // Pantalla 1
  amount: number | null = null;

  // Pantalla 2
  calculating = false;
  groups: FrequencyGroup[] = [];
  noResults = false;

  // Pantalla 3
  selected: SimulateOption | null = null;

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
          this.loadingOptions = false;
        },
        error: () => {
          this.optionsError = 'No se pudieron cargar las opciones de cuotas.';
          this.loadingOptions = false;
        },
      });
  }

  get hasOptions(): boolean {
    return Object.keys(this.optionsByFrequency).length > 0;
  }

  continue(): void {
    if (!this.amount || this.amount <= 0) return;

    this.calculating = true;
    this.groups = [];
    this.noResults = false;
    this.step = 2;

    const calls: Array<{ frequency: string; installments: number }> = [];
    for (const [frequency, counts] of Object.entries(this.optionsByFrequency)) {
      for (const installments of counts) {
        calls.push({ frequency, installments });
      }
    }

    if (calls.length === 0) {
      this.calculating = false;
      this.noResults = true;
      return;
    }

    const requests = calls.map(({ frequency, installments }) =>
      this.api
        .post<Record<string, unknown>>('credits/simulate', {
          type:               'LOAN',
          total_amount:       this.amount,
          installments_count: installments,
          payment_frequency:  frequency,
        })
        .pipe(
          map(raw => ({ frequency, installments, result: toResult(raw) })),
          catchError(() => of(null)),
        ),
    );

    forkJoin(requests).subscribe(results => {
      const grouped: Record<string, FrequencyGroup> = {};

      for (const res of results) {
        if (!res) continue;
        const { frequency, installments, result } = res;
        if (!grouped[frequency]) {
          grouped[frequency] = {
            frequency,
            label: FREQUENCY_LABELS[frequency] ?? frequency,
            options: [],
          };
        }
        grouped[frequency].options.push({
          frequency,
          frequencyLabel: FREQUENCY_LABELS[frequency] ?? frequency,
          installments,
          result,
        });
      }

      for (const g of Object.values(grouped)) {
        g.options.sort((a, b) => a.installments - b.installments);
      }

      this.groups = Object.values(grouped);
      this.noResults = this.groups.length === 0;
      this.calculating = false;
    });
  }

  select(option: SimulateOption): void {
    this.selected = option;
    this.step = 3;
  }

  back(): void {
    this.step = 2;
    this.selected = null;
  }

  restart(): void {
    this.step = 1;
    this.selected = null;
    this.groups = [];
    this.noResults = false;
  }
}
