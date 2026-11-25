import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InstallmentsService } from '../../../../features/seller/operations/installments.service';
import { CashStatusService } from '../../cash-register/cash-status.service';
import { DelinquencyRow } from '../../models/interface/delinquency';

@Component({
  selector: 'app-delinquency-apply-dialog',
  standalone: true,
  imports: [FormsModule, ButtonModule, DialogModule],
  templateUrl: './delinquency-apply-dialog.component.html',
})
export class DelinquencyApplyDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() row: DelinquencyRow | null = null;
  /** Emite el ID y monto de mora aplicado cuando la operación es exitosa. */
  @Output() penaltyApplied = new EventEmitter<{ id: string; amount: number }>();

  private readonly installmentsService = inject(InstallmentsService);
  private readonly cashStatusSvc = inject(CashStatusService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  applyAmount: number | null = null;
  loading = false;

  /**
   * Vacía el monto al abrir el diálogo o cambiar de fila, para que no se
   * arrastre la mora cargada para otra cuota.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true || changes['row']) {
      this.applyAmount = null;
    }
  }

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

    this.cashStatusSvc
      .checkAction('aplicar mora', 'No puedes aplicar mora. La caja del día está CERRADA.')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((block) => {
        if (block) {
          this.loading = false;
          this.msg.add(block);
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
            severity: 'warn',
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
