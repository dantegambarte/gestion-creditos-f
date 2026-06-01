import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { catchError, of } from 'rxjs';
import { InstallmentsService } from '../../../features/seller/operations/installments.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { DelinquencyRow } from '../models/interface/delinquency';

@Component({
  selector: 'app-delinquency-apply-dialog',
  standalone: true,
  imports: [FormsModule, ButtonModule, DialogModule],
  templateUrl: './delinquency-apply-dialog.component.html',
})
export class DelinquencyApplyDialogComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() row: DelinquencyRow | null = null;
  /** Emite el ID y monto de mora aplicado cuando la operación es exitosa. */
  @Output() penaltyApplied = new EventEmitter<{ id: string; amount: number }>();

  private readonly installmentsService = inject(InstallmentsService);
  private readonly cashRegisterSvc = inject(CashRegisterService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  applyAmount: number | null = null;
  loading = false;

  /**
   * Cierra el diálogo y emite el cambio de visibilidad.
   */
  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  /**
   * Verifica el estado de caja antes de aplicar mora. Si la caja está cerrada, muestra error.
   */
  confirmApply(): void {
    if (!this.row || !this.applyAmount || this.applyAmount <= 0) return;

    this.loading = true;

    this.cashRegisterSvc
      .getDashboard()
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((dashboard) => {
        const isCashClosed = dashboard?.isClosed ?? false;

        if (isCashClosed) {
          this.loading = false;
          this.msg.add({
            severity: 'error',
            summary: 'Caja Cerrada',
            detail: 'No puedes aplicar mora. La caja del día está CERRADA.',
            life: 5000,
          });
          return;
        }

        this.processApplyPenalty();
      });
  }

  /**
   * Llama al servicio para aplicar el monto de mora a la cuota y emite el resultado.
   */
  private processApplyPenalty(): void {
    if (!this.row || !this.applyAmount) return;

    const row = this.row;
    this.installmentsService
      .applyPenalty(row.id, { penaltyAmount: this.applyAmount })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.loading = false;
          this.close();
          this.penaltyApplied.emit({
            id: row.id,
            amount: updated.penaltyAmount ?? this.applyAmount!,
          });
          this.msg.add({
            severity: 'warning',
            summary: 'Mora aplicada',
            detail: row.clientName,
            life: 3000,
          });
        },
        error: (err: { status?: number; message?: string }) => {
          this.loading = false;
          this.msg.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary: err.status === 409 ? 'Advertencia' : 'Error',
            detail: err.message ?? 'No se pudo aplicar mora.',
          });
        },
      });
  }
}
