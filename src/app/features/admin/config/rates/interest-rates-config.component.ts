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
import {
  CreateForm,
  InterestRate,
  InterestRateCreatePayload,
  PaymentFrequency,
  RateGroup,
} from '../models/interfaces/interest-rate.model';
import { FormatService } from '../../../../core/services/format.service';
import { InterestRatesService } from '../services/interest-rates.service';

const FREQ_LABELS: Record<PaymentFrequency, string> = {
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quincenal',
  MONTHLY: 'Mensual',
};

@Component({
  selector: 'app-interest-rates-config',
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
  templateUrl: './interest-rates-config.component.html',
})
export class InterestRatesConfigComponent implements OnInit {
  private readonly svc = inject(InterestRatesService);
  private readonly msg = inject(MessageService);
  private readonly fmt = inject(FormatService);

  loading = true;
  saving = false;
  allRates: InterestRate[] = [];

  filterFrequency: PaymentFrequency | null = null;
  filterActive: 'all' | 'true' | 'false' = 'all';

  readonly freqOptions = [
    { label: 'Todas las frecuencias', value: null },
    { label: 'Semanal', value: 'WEEKLY' as PaymentFrequency },
    { label: 'Quincenal', value: 'BIWEEKLY' as PaymentFrequency },
    { label: 'Mensual', value: 'MONTHLY' as PaymentFrequency },
  ];

  readonly activeOptions = [
    { label: 'Todas', value: 'all' },
    { label: 'Activas', value: 'true' },
    { label: 'Inactivas', value: 'false' },
  ];

  showCreateDialog = false;
  createForm: CreateForm = this.emptyForm();
  createError = '';

  showEditDialog = false;
  editingRate: InterestRate | null = null;
  editRatePercent: number | null = null;

  showConfirmDialog = false;
  confirmMessage = '';
  private pendingAction: (() => void) | null = null;

  ngOnInit(): void {
    this.load();
  }

  /**
   * Carga las tasas de interés desde el servicio `InterestRatesService` y maneja el estado de carga y errores. Al iniciar la carga, establece `loading` en `true`. Si la carga es exitosa, almacena las tasas en `allRates` y establece `loading` en `false`. Si ocurre un error durante la carga, también establece `loading` en `false` y muestra un mensaje de error utilizando `MessageService`.
   */
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

  /**
   * Devuelve las tasas de interés agrupadas por frecuencia de pago, aplicando los filtros seleccionados por el usuario. Primero filtra las tasas según la frecuencia de pago (`filterFrequency`) y el estado de activación (`filterActive`). Luego, agrupa las tasas filtradas en objetos `RateGroup` que contienen la frecuencia, una etiqueta legible y las tasas correspondientes a esa frecuencia. Finalmente, devuelve un arreglo de grupos que solo incluye aquellos que tienen al menos una tasa después de aplicar los filtros.
   */
  get groups(): RateGroup[] {
    const filtered = this.allRates.filter((r) => {
      if (this.filterFrequency && r.paymentFrequency !== this.filterFrequency)
        return false;
      if (this.filterActive === 'true' && !r.active) return false;
      if (this.filterActive === 'false' && r.active) return false;
      return true;
    });

    const order: PaymentFrequency[] = ['WEEKLY', 'BIWEEKLY', 'MONTHLY'];
    return order
      .map((freq) => ({
        frequency: freq,
        label: FREQ_LABELS[freq],
        rates: filtered.filter((r) => r.paymentFrequency === freq),
      }))
      .filter((g) => g.rates.length > 0);
  }

  /**
   * Devuelve la etiqueta legible para una frecuencia de pago.
   * @param freq
   * @returns
   */
  freqLabel(freq: PaymentFrequency): string {
    return FREQ_LABELS[freq];
  }

  /**
   * Devuelve el rango de montos para una tasa de interés.
   * @param rate
   * @returns
   */
  amountRange(rate: InterestRate): string {
    const min = this.fmt.number(rate.minAmount);
    if (rate.maxAmount === null) return `$${min} en adelante`;
    const max = this.fmt.number(rate.maxAmount);
    return `$${min} – $${max}`;
  }

  rateDisplay(rate: number): string {
    return this.fmt.percent(rate);
  }

  /**
   * Abre el diálogo para crear una nueva tasa de interés.
   */
  openCreate(): void {
    this.createForm = this.emptyForm();
    this.createError = '';
    this.showCreateDialog = true;
  }

  /**
   * Envía la solicitud para crear una nueva tasa de interés.
   * @returns
   */
  submitCreate(): void {
    const f = this.createForm;
    if (
      !f.paymentFrequency ||
      f.installmentsCount == null ||
      f.minAmount == null ||
      f.ratePercent == null
    )
      return;

    const payload: InterestRateCreatePayload = {
      paymentFrequency: f.paymentFrequency,
      installmentsCount: f.installmentsCount,
      minAmount: f.minAmount,
      rate: f.ratePercent / 100,
    };
    if (f.maxAmount != null) payload.maxAmount = f.maxAmount;

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
        if (err.status === 409) {
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

  /**
   * Abre el diálogo para editar una tasa de interés existente.
   * @param rate
   */
  openEdit(rate: InterestRate): void {
    this.editingRate = rate;
    this.editRatePercent = parseFloat((rate.rate * 100).toFixed(4));
    this.showEditDialog = true;
  }

  /**
   * Envía la solicitud para editar una tasa de interés existente.
   * @returns
   */
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

  /**
   * Confirma la acción de activar o desactivar una tasa de interés.
   * @param rate
   */
  confirmToggle(rate: InterestRate): void {
    const action = rate.active ? 'desactivar' : 'activar';
    this.confirmMessage = `¿Seguro que desea ${action} esta tasa?`;
    this.pendingAction = () => this.executeToggle(rate);
    this.showConfirmDialog = true;
  }

  /**
   * Ejecuta la acción de activar o desactivar una tasa de interés.
   * @param rate
   */
  private executeToggle(rate: InterestRate): void {
    const obs: Observable<InterestRate | void> = rate.active
      ? this.svc.deactivate(rate.id)
      : this.svc.activate(rate.id);
    obs.subscribe({
      next: (result: InterestRate | void) => {
        if (result) {
          this.replaceRate(result as InterestRate);
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

  /**
   * Maneja la confirmación de la acción en el diálogo de confirmación, ejecutando la acción pendiente si existe y cerrando el diálogo.
   */
  onConfirm(): void {
    this.showConfirmDialog = false;
    this.pendingAction?.();
    this.pendingAction = null;
  }

  /**
   * Maneja la cancelación de la acción en el diálogo de confirmación, simplemente cerrando el diálogo y limpiando la acción pendiente.
   */
  onCancelConfirm(): void {
    this.showConfirmDialog = false;
    this.pendingAction = null;
  }

  /**
   * Reemplaza una tasa de interés en la lista de tasas.
   * @param updated
   */
  private replaceRate(updated: InterestRate): void {
    this.allRates = this.allRates.map((r) =>
      r.id === updated.id ? updated : r,
    );
  }

  /**
   * Crea un formulario vacío para crear una nueva tasa de interés.
   * @returns
   */
  private emptyForm(): CreateForm {
    return {
      paymentFrequency: null,
      installmentsCount: null,
      minAmount: null,
      maxAmount: null,
      ratePercent: null,
    };
  }
}
