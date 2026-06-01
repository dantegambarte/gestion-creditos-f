import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../../../core/models/app-error';
import { FormatService } from '../../../../../core/services/format.service';
import { CurrencyAmountInputDirective } from '../../../../../shared/directives/currency-amount-input.directive';
import { LoadingStateComponent } from '../../../../../shared/states/loading-state/loading-state.component';
import {
  CashRegister,
  CashRegisterClosePayload,
  CashRegisterPreClose,
} from '../../../models/cash-register.model';
import { CashRegisterService } from '../../cash-register.service';

@Component({
  selector: 'app-cash-register-close-panel',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    InputNumberModule,
    InputTextareaModule,
    CurrencyAmountInputDirective,
    LoadingStateComponent,
  ],
  templateUrl: './cash-register-close-panel.component.html',
})
export class CashRegisterClosePanelComponent implements OnInit, OnDestroy {
  /** Emite cuando el usuario cierra el panel sin confirmar. */
  @Output() closed = new EventEmitter<void>();
  /** Emite el registro generado tras un cierre exitoso. */
  @Output() closedSuccessfully = new EventEmitter<CashRegister>();

  private readonly service = inject(CashRegisterService);
  private readonly msg = inject(MessageService);
  readonly format = inject(FormatService);
  private destroy$ = new Subject<void>();

  preClose: CashRegisterPreClose | null = null;
  loadingPreClose = false;
  declaredCash: number | null = null;
  observations = '';
  closing = false;
  closePendingError: string | null = null;

  get closeDifference(): number {
    if (this.declaredCash == null || !this.preClose) return 0;
    return this.declaredCash - this.preClose.efectivo.esperado;
  }

  /**
   * Carga el resumen de pre-cierre al montar el panel.
   */
  ngOnInit(): void {
    this.loadPreClose();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Recarga el resumen de pre-cierre reseteando el estado del formulario.
   */
  loadPreClose(): void {
    this.declaredCash = null;
    this.observations = '';
    this.closePendingError = null;
    this.preClose = null;
    this.loadingPreClose = true;
    this.service
      .getPreClose()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (pc) => {
          this.preClose = pc;
          this.loadingPreClose = false;
        },
        error: () => {
          this.loadingPreClose = false;
        },
      });
  }

  /**
   * Confirma el cierre de la caja.
   * @param force si es true, fuerza el cierre ignorando pendientes
   */
  confirmClose(force = false): void {
    if (this.declaredCash == null) return;
    const payload: CashRegisterClosePayload = {
      declaredCash: this.declaredCash,
    };
    if (this.observations.trim())
      payload.observations = this.observations.trim();
    if (force) payload.force = true;

    this.closing = true;
    this.closePendingError = null;
    this.service
      .close(payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.closing = false;
        }),
      )
      .subscribe({
        next: (reg) => {
          this.msg.add({
            severity: 'success',
            summary: 'Caja cerrada',
            detail: 'Cierre de caja registrado correctamente.',
            life: 5000,
          });
          this.closedSuccessfully.emit(reg);
          this.closed.emit();
        },
        error: (err: AppError) => {
          if (err.status === 409) {
            const isPendingCredits =
              err.message?.includes('pre-carga') ||
              err.message?.includes('pendiente');
            if (isPendingCredits) {
              this.closePendingError = err.message;
            } else {
              this.msg.add({
                severity: 'warn',
                summary: 'Caja ya cerrada',
                detail: err.message,
                life: 5000,
              });
              this.closed.emit();
            }
          } else {
            this.msg.add({
              severity: 'error',
              summary: 'Error',
              detail: err.message ?? 'No se pudo cerrar la caja.',
              life: 5000,
            });
          }
        },
      });
  }

  /**
   * Formatea un valor como moneda.
   * @param value monto a formatear
   */
  formatCurrency(value: number): string {
    return this.format.currency(value);
  }
}
