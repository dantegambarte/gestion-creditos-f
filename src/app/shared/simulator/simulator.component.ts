import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LowerCasePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
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

const FREQUENCY_ORDER: Record<string, number> = {
  WEEKLY:   0,
  BIWEEKLY: 1,
  MONTHLY:  2,
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

export interface SimulateProductVariant {
  id: string;
  color: string | null;
  size: string | null;
  capacity: string | null;
  currentPrice: number;
  label: string;
}

export interface SimulateProduct {
  id: string;
  title: string;
  variants: SimulateProductVariant[];
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
  imports: [FormsModule, LowerCasePipe, ButtonModule, DropdownModule, InputNumberModule, SkeletonModule, CurrencyArsPipe],
  templateUrl: './simulator.component.html',
})
export class SimulatorComponent implements OnInit {
  private readonly api    = inject(ApiHttpService);
  private readonly header = inject(HeaderService);

  loadingOptions = true;
  optionsError = '';
  private optionsByFrequency: Record<string, number[]> = {};

  step: 1 | 2 | 3 = 1;

  // Pantalla 1 — tipo de operación
  operationType: 'LOAN' | 'SALE' = 'LOAN';

  // Pantalla 1 — LOAN
  amount: number | null = null;

  // Pantalla 1 — SALE
  loadingProducts = false;
  products: SimulateProduct[] = [];
  selectedProduct: SimulateProduct | null = null;
  selectedVariant: SimulateProductVariant | null = null;

  // Contexto que se preserva al avanzar a pantalla 2/3
  simulatedAmount: number | null = null;
  simulatedProductTitle = '';
  simulatedVariantLabel = '';

  // Pantalla 2
  calculating = false;
  groups: FrequencyGroup[] = [];
  noResults = false;
  visibleCounts: Record<string, number> = {};

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

  private loadProducts(): void {
    this.loadingProducts = true;
    this.api
      .get<Record<string, unknown>[]>('credits/simulate/products')
      .subscribe({
        next: (data) => {
          this.products = data.map(p => ({
            id:       p['id'] as string,
            title:    p['title'] as string,
            variants: (p['variants'] as Record<string, unknown>[]).map(v => {
              const parts = [v['color'], v['size'], v['capacity']].filter(Boolean) as string[];
              return {
                id:           v['id'] as string,
                color:        v['color'] as string | null,
                size:         v['size'] as string | null,
                capacity:     v['capacity'] as string | null,
                currentPrice: v['current_price'] as number,
                label:        parts.length > 0 ? parts.join(' / ') : 'Sin especificaciones',
              };
            }),
          }));
          this.loadingProducts = false;
        },
        error: () => { this.loadingProducts = false; },
      });
  }

  get hasOptions(): boolean {
    return Object.keys(this.optionsByFrequency).length > 0;
  }

  get canContinue(): boolean {
    if (this.operationType === 'LOAN') return !!this.amount && this.amount > 0;
    return !!this.selectedVariant;
  }

  setOperationType(type: 'LOAN' | 'SALE'): void {
    if (this.operationType === type) return;
    this.operationType = type;
    this.amount = null;
    this.selectedProduct = null;
    this.selectedVariant = null;
    if (type === 'SALE' && this.products.length === 0 && !this.loadingProducts) {
      this.loadProducts();
    }
  }

  onProductChange(): void {
    this.selectedVariant = null;
  }

  private buildGroups(results: Record<string, unknown>[]): void {
    const grouped: Record<string, FrequencyGroup> = {};

    for (const raw of results) {
      const result = toResult(raw);
      const frequency = result.paymentFrequency;
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
        installments:   result.installmentsCount,
        result,
      });
    }

    for (const g of Object.values(grouped)) {
      g.options.sort((a, b) => a.installments - b.installments);
    }

    this.groups = Object.values(grouped)
      .sort((a, b) => (FREQUENCY_ORDER[a.frequency] ?? 99) - (FREQUENCY_ORDER[b.frequency] ?? 99));
    for (const g of this.groups) {
      this.visibleCounts[g.frequency] = 3;
    }
    this.noResults = this.groups.length === 0;
    this.calculating = false;
  }

  continue(): void {
    if (!this.canContinue) return;

    this.calculating = true;
    this.groups = [];
    this.noResults = false;
    this.visibleCounts = {};
    this.step = 2;

    if (this.operationType === 'LOAN') {
      this.simulatedAmount = this.amount;
      this.simulatedProductTitle = '';
      this.simulatedVariantLabel = '';
    } else {
      this.simulatedAmount = this.selectedVariant!.currentPrice;
      this.simulatedProductTitle = this.selectedProduct!.title;
      this.simulatedVariantLabel = this.selectedVariant!.label;
    }

    const payload = this.operationType === 'LOAN'
      ? { type: 'LOAN', total_amount: this.amount }
      : { type: 'SALE', products: [{ variant_id: this.selectedVariant!.id, quantity: 1 }] };

    this.api
      .post<Record<string, unknown>[]>('credits/simulate/all', payload)
      .subscribe({
        next: (results) => this.buildGroups(results),
        error: () => {
          this.noResults = true;
          this.calculating = false;
        },
      });
  }

  visibleOptions(group: FrequencyGroup): SimulateOption[] {
    return group.options.slice(0, this.visibleCounts[group.frequency] ?? 3);
  }

  hasMore(group: FrequencyGroup): boolean {
    return (this.visibleCounts[group.frequency] ?? 3) < group.options.length;
  }

  showMore(frequency: string): void {
    this.visibleCounts[frequency] = (this.visibleCounts[frequency] ?? 3) + 3;
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
    this.visibleCounts = {};
    this.simulatedAmount = null;
    this.simulatedProductTitle = '';
    this.simulatedVariantLabel = '';
  }
}
