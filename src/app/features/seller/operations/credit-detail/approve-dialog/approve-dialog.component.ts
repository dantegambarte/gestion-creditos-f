import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { AppError } from '../../../../../core/models/app-error';
import { AuthServiceBase } from '../../../../../core/auth/auth-service.base';
import { CreditDetail } from '../../../models/credit.model';
import { CreditsService } from '../../credits.service';

@Component({
  selector: 'app-approve-dialog',
  standalone: true,
  imports: [FormsModule, ButtonModule, DialogModule, TooltipModule],
  templateUrl: './approve-dialog.component.html',
})
export class ApproveDialogComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() credit: CreditDetail | null = null;
  @Input() isCashClosed = false;
  /** Emite el crédito actualizado para que el padre reemplaze su estado. */
  @Output() approved = new EventEmitter<CreditDetail>();

  installmentsCount: number | null = null;
  processing = false;

  private readonly creditsSvc = inject(CreditsService);
  private readonly auth = inject(AuthServiceBase);
  private readonly msg = inject(MessageService);

  /**
   * Indica si la operación en aprobación es una venta y debe usar las cuotas ya definidas.
   * @returns {boolean} True cuando no corresponde ajustar cuotas manualmente.
   */
  get usesFixedInstallments(): boolean {
    return this.credit?.type === 'SALE';
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  /**
   * Ejecuta la aprobación; si se modificó la cantidad de cuotas, la incluye en el payload.
   */
  confirm(): void {
    if (!this.credit) return;

    if (this.isCashClosed) {
      this.msg.add({
        severity: 'error',
        summary: 'Caja Cerrada',
        detail:
          'No puedes aprobar créditos. La caja del día está CERRADA. El crédito + enganche se aprobarán juntos cuando se abra una nueva caja.',
        life: 5000,
      });
      return;
    }

    this.processing = true;
    const payload = this.usesFixedInstallments
      ? {}
      : this.installmentsCount !== null &&
          this.installmentsCount !== this.credit.installmentsCount
        ? { installmentsCount: this.installmentsCount }
        : {};

    this.creditsSvc.approve(this.credit.id, payload).subscribe({
      next: (updated) => {
        this.processing = false;
        this.close();
        this.auth.patchCurrentUser({
          pending_approvals_count: Math.max(
            (this.auth.snapshot?.pending_approvals_count ?? 1) - 1,
            0,
          ),
        });
        this.msg.add({
          severity: 'success',
          summary: 'Aprobado',
          detail: 'Crédito aprobado. Cuotas generadas correctamente.',
          life: 4000,
        });
        this.approved.emit(updated);
      },
      error: (err: AppError) => {
        this.processing = false;
        this.msg.add({
          severity: err.status === 409 ? 'warn' : 'error',
          summary: err.status === 409 ? 'Advertencia' : 'Error',
          detail: err.message ?? 'No se pudo aprobar.',
        });
      },
    });
  }
}
