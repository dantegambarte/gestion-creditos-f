import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { AppError } from '../../../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import {
  CreditDetail,
  ExcessDisposition,
  PlanChangeResult,
  PlanChangeSimulation,
} from '../../../models/credit.model';
import { CreditsService } from '../../credits.service';

/**
 * Cambio de plan de un crédito ACTIVE: recalcula el saldo con la tasa de un plan
 * más corto dejando una única cuota viva. El plan destino lo determina el backend
 * (cuotas_pagadas + 1). Flujo: al abrir, simula; el admin revisa y confirma.
 * Operación definitiva (sin reversión), admin-only. Si el cliente pagó de más,
 * exige elegir destino del excedente: saldo a favor o devolución (egreso de caja).
 */
@Component({
  selector: 'app-plan-change-dialog',
  standalone: true,
  imports: [FormsModule, ButtonModule, DialogModule, InputTextareaModule, CurrencyArsPipe],
  templateUrl: './plan-change-dialog.component.html',
})
export class PlanChangeDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() credit: CreditDetail | null = null;
  /** Emite cuando el cambio se aplicó con éxito. El padre recarga el crédito. */
  @Output() planChanged = new EventEmitter<void>();

  reason = '';
  simulation: PlanChangeSimulation | null = null;
  simulating = false;
  processing = false;
  error: string | null = null;
  /** Destino elegido para el excedente (solo si la simulación lo exige). */
  excessDisposition: ExcessDisposition | null = null;

  private readonly creditsService = inject(CreditsService);
  private readonly msg = inject(MessageService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.reason = '';
      this.simulation = null;
      this.processing = false;
      this.error = null;
      this.excessDisposition = null;
      this.loadSimulation();
    }
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  /** Carga la simulación al abrir el diálogo (SIMULAR antes de confirmar). */
  private loadSimulation(): void {
    if (!this.credit) return;
    this.simulating = true;
    this.error = null;
    this.creditsService.simulatePlanChange(this.credit.id).subscribe({
      next: (sim) => {
        this.simulation = sim;
        this.simulating = false;
      },
      error: (err: AppError) => {
        this.simulating = false;
        this.error = err.message ?? 'Este crédito no es elegible para cambio de plan.';
      },
    });
  }

  /**
   * Indica si se puede confirmar: hay simulación y, si hay excedente, ya se
   * eligió su destino (saldo a favor o devolución).
   */
  get canConfirm(): boolean {
    if (this.simulating || this.processing || !this.simulation) return false;
    return !this.simulation.requiresExcessDisposition || !!this.excessDisposition;
  }

  /**
   * Confirma y ejecuta el cambio de plan. Si hay excedente, envía el destino
   * elegido en `excess_disposition`.
   */
  confirm(): void {
    if (!this.canConfirm || !this.credit || !this.simulation) return;
    this.processing = true;
    const payload: { reason?: string; excess_disposition?: ExcessDisposition } = {
      reason: this.reason.trim() || undefined,
    };
    if (this.simulation.requiresExcessDisposition && this.excessDisposition)
      payload.excess_disposition = this.excessDisposition;
    this.creditsService.changePlan(this.credit.id, payload).subscribe({
      next: (res: PlanChangeResult) => {
        this.processing = false;
        this.close();
        this.msg.add({
          severity: 'success',
          summary: 'Plan cambiado',
          detail: res.message,
          life: 7000,
        });
        this.planChanged.emit();
      },
      error: (err: AppError) => {
        this.processing = false;
        this.msg.add({
          severity: err.status === 409 || err.status === 422 ? 'warn' : 'error',
          summary: 'No se pudo cambiar el plan',
          detail:
            err.code === 'EXCESS_DISPOSITION_REQUIRED'
              ? 'El cliente pagó de más. Elegí si el excedente queda como saldo a favor o devolución antes de confirmar.'
              : (err.message ?? 'Error al ejecutar el cambio de plan.'),
        });
      },
    });
  }
}
