import { NgClass } from '@angular/common';
import { FfBackTopFabComponent } from './../../../../shared/components/back-top-fab/ff-back-top-fab.component';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { Observable } from 'rxjs';
import { AppError } from '../../../../core/models/app-error';
import { Product } from '../../../seller/models/product.model';
import { ProductsService } from '../../../seller/products/products.service';
import {
  CreateForm,
  PaymentFrequency,
  ProductRate,
  ProductRateCreatePayload,
  ProductRateGroup,
} from '../models/interfaces/product';
import { ProductRatesService } from '../services/product-rates.service';

const FREQ_LABELS: Record<PaymentFrequency, string> = {
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quincenal',
  MONTHLY: 'Mensual',
};

@Component({
  selector: 'app-product-rates-config',
  standalone: true,
  imports: [
    FfBackTopFabComponent,
    NgClass,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    DropdownModule,
    SkeletonModule,
    TableModule,
    TagModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './product-rates-config.component.html',
})
export class ProductRatesConfigComponent implements OnInit {
  private readonly svc = inject(ProductRatesService);
  private readonly productsSvc = inject(ProductsService);
  private readonly msg = inject(MessageService);

  loading = true;
  saving = false;
  allRates: ProductRate[] = [];
  allProducts: Product[] = [];

  filterProductId: string | null = null;

  readonly freqOptions = [
    { label: 'Semanal', value: 'WEEKLY' as PaymentFrequency },
    { label: 'Quincenal', value: 'BIWEEKLY' as PaymentFrequency },
    { label: 'Mensual', value: 'MONTHLY' as PaymentFrequency },
  ];

  showCreateDialog = false;
  createForm: CreateForm = this.emptyForm();
  createError = '';

  showEditDialog = false;
  editingRate: ProductRate | null = null;
  editRatePercent: number | null = null;

  showConfirmDialog = false;
  confirmMessage = '';
  private pendingAction: (() => void) | null = null;

  ngOnInit(): void {
    this.load();
    this.loadProducts();
  }

  get productFilterOptions(): { label: string; value: string | null }[] {
    const unique = new Map<string, string>();
    this.allRates.forEach((r) => unique.set(r.productId, r.productName));
    return [
      { label: 'Todos los productos', value: null },
      ...Array.from(unique.entries()).map(([id, name]) => ({
        label: name,
        value: id,
      })),
    ];
  }

  get activeProductOptions(): { label: string; value: string }[] {
    return this.allProducts
      .filter((p) => p.status === 'ACTIVE')
      .map((p) => ({ label: p.title, value: p.id }));
  }

  get groups(): ProductRateGroup[] {
    const filtered = this.filterProductId
      ? this.allRates.filter((r) => r.productId === this.filterProductId)
      : this.allRates;

    const map = new Map<string, ProductRateGroup>();
    filtered.forEach((r) => {
      if (!map.has(r.productId)) {
        map.set(r.productId, {
          productId: r.productId,
          productName: r.productName,
          rates: [],
        });
      }
      map.get(r.productId)!.rates.push(r);
    });
    return Array.from(map.values());
  }

  freqLabel(freq: PaymentFrequency): string {
    return FREQ_LABELS[freq];
  }

  rateDisplay(rate: number): string {
    return (rate * 100).toFixed(2) + '%';
  }

  openCreate(): void {
    this.createForm = this.emptyForm();
    this.createError = '';
    this.showCreateDialog = true;
  }

  submitCreate(): void {
    const f = this.createForm;
    if (
      !f.productId ||
      !f.paymentFrequency ||
      f.installmentsCount == null ||
      f.ratePercent == null
    )
      return;

    const payload: ProductRateCreatePayload = {
      productId: f.productId,
      paymentFrequency: f.paymentFrequency,
      installmentsCount: f.installmentsCount,
      rate: f.ratePercent / 100,
    };

    this.saving = true;
    this.createError = '';
    this.svc.create(payload).subscribe({
      next: (created) => {
        this.saving = false;
        this.showCreateDialog = false;
        this.allRates = [...this.allRates, created];
        this.msg.add({
          severity: 'success',
          summary: 'Tasa creada',
          detail: 'La tasa fue creada correctamente.',
        });
      },
      error: (err: AppError) => {
        this.saving = false;
        if (err.status === 409 || err.status === 404) {
          this.msg.add({
            severity: 'warn',
            summary: 'Conflicto',
            detail: err.message,
          });
        } else {
          this.createError = err.message;
        }
      },
    });
  }

  openEdit(rate: ProductRate): void {
    this.editingRate = rate;
    this.editRatePercent = parseFloat((rate.rate * 100).toFixed(4));
    this.showEditDialog = true;
  }

  submitEdit(): void {
    if (!this.editingRate || this.editRatePercent == null) return;
    this.saving = true;
    this.svc
      .update(this.editingRate.id, { rate: this.editRatePercent / 100 })
      .subscribe({
        next: (updated) => {
          this.saving = false;
          this.showEditDialog = false;
          this.replaceRate(updated);
          this.msg.add({
            severity: 'success',
            summary: 'Tasa actualizada',
            detail: 'La tasa fue actualizada.',
          });
        },
        error: (err: AppError) => {
          this.saving = false;
          this.msg.add({
            severity: 'error',
            summary: 'Error',
            detail: err.message,
          });
        },
      });
  }

  confirmToggle(rate: ProductRate): void {
    const action = rate.active ? 'desactivar' : 'activar';
    this.confirmMessage = `¿Seguro que desea ${action} esta tasa?`;
    this.pendingAction = () => this.executeToggle(rate);
    this.showConfirmDialog = true;
  }

  private executeToggle(rate: ProductRate): void {
    const obs: Observable<ProductRate | void> = rate.active
      ? this.svc.deactivate(rate.id)
      : this.svc.activate(rate.id);
    obs.subscribe({
      next: (result: ProductRate | void) => {
        if (result) {
          this.replaceRate(result as ProductRate);
        } else {
          this.allRates = this.allRates.map((r) =>
            r.id === rate.id ? { ...r, active: false } : r,
          );
        }
        const label = rate.active ? 'desactivada' : 'activada';
        this.msg.add({
          severity: 'success',
          summary: 'Listo',
          detail: `Tasa ${label}.`,
        });
      },
      error: (err: AppError) => {
        if (err.status === 409) {
          this.msg.add({
            severity: 'warn',
            summary: 'Conflicto',
            detail: err.message,
          });
        } else {
          this.msg.add({
            severity: 'error',
            summary: 'Error',
            detail: err.message,
          });
        }
      },
    });
  }

  onConfirm(): void {
    this.showConfirmDialog = false;
    this.pendingAction?.();
    this.pendingAction = null;
  }

  onCancelConfirm(): void {
    this.showConfirmDialog = false;
    this.pendingAction = null;
  }

  private replaceRate(updated: ProductRate): void {
    this.allRates = this.allRates.map((r) =>
      r.id === updated.id ? updated : r,
    );
  }

  private load(): void {
    this.loading = true;
    this.svc.getAll().subscribe({
      next: (rates) => {
        this.allRates = rates;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.msg.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las tasas.',
        });
      },
    });
  }

  private loadProducts(): void {
    this.productsSvc.list({ status: 'ACTIVE' }).subscribe({
      next: (products) => (this.allProducts = products),
      error: () => {},
    });
  }

  private emptyForm(): CreateForm {
    return {
      productId: null,
      paymentFrequency: null,
      installmentsCount: null,
      ratePercent: null,
    };
  }
}
