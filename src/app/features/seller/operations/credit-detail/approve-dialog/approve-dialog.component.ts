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
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { AppError } from '../../../../../core/models/app-error';
import { AuthServiceBase } from '../../../../../core/auth/auth-service.base';
import { CreditDetail } from '../../../models/credit.model';
import { CreditsService } from '../../credits.service';
import { UsersService } from '../../../../admin/users/users.service';

@Component({
  selector: 'app-approve-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    TooltipModule,
  ],
  templateUrl: './approve-dialog.component.html',
})
export class ApproveDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() credit: CreditDetail | null = null;
  @Input() isCashClosed = false;
  /** Emite el crédito actualizado para que el padre reemplaze su estado. */
  @Output() approved = new EventEmitter<CreditDetail>();
  /** Emite el crédito con el vendedor ya reasignado (antes de aprobar). */
  @Output() sellerChanged = new EventEmitter<CreditDetail>();

  installmentsCount: number | null = null;
  processing = false;

  // Cambio de vendedor antes de aprobar (mismo patrón que la pantalla de aprobaciones).
  showChangeSeller = false;
  sellerOptions: { label: string; value: string }[] = [];
  loadingSellers = false;
  selectedSellerId: string | null = null;
  processingSeller = false;

  private readonly creditsSvc = inject(CreditsService);
  private readonly usersSvc = inject(UsersService);
  private readonly auth = inject(AuthServiceBase);
  private readonly msg = inject(MessageService);

  /** Reinicia el form de vendedor cada vez que se abre/cierra el diálogo. */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']) {
      this.showChangeSeller = false;
      this.selectedSellerId = null;
    }
  }

  /**
   * Indica si la operación en aprobación es una venta y debe usar las cuotas ya definidas.
   * @returns {boolean} True cuando no corresponde ajustar cuotas manualmente.
   */
  get usesFixedInstallments(): boolean {
    return this.credit?.type === 'SALE';
  }

  /** Nombre del vendedor actual del crédito. */
  get currentSellerName(): string {
    return this.credit?.createdByName ?? '—';
  }

  /** ID del vendedor actual (preselección y detección de "mismo vendedor"). */
  get currentSellerId(): string | null {
    return this.credit?.createdById ?? null;
  }

  /** Abre el form inline para cambiar el vendedor y carga la lista (1 sola vez). */
  openChangeSeller(): void {
    this.selectedSellerId = this.currentSellerId;
    this.showChangeSeller = true;
    if (this.sellerOptions.length === 0) {
      this.loadingSellers = true;
      this.usersSvc
        .list({ roles: 'SELLER,SELLER_COLLECTOR', status: 'ACTIVE' })
        .subscribe({
          next: (users) => {
            this.sellerOptions = users.map((u) => ({
              label: u.fullName,
              value: u.id,
            }));
            this.loadingSellers = false;
          },
          error: () => {
            this.loadingSellers = false;
          },
        });
    }
  }

  /** Cierra el form de cambio de vendedor sin guardar. */
  cancelChangeSeller(): void {
    this.showChangeSeller = false;
  }

  /** Guarda el nuevo vendedor (PATCH /credits/:id/seller) y refresca el detalle. */
  saveSeller(): void {
    if (!this.credit || !this.selectedSellerId) return;
    if (this.selectedSellerId === this.currentSellerId) {
      this.showChangeSeller = false;
      return;
    }
    this.processingSeller = true;
    this.creditsSvc.changeSeller(this.credit.id, this.selectedSellerId).subscribe({
      next: (updated) => {
        if (this.credit) {
          this.credit.createdById = updated.createdById;
          this.credit.createdByName = updated.createdByName;
        }
        this.processingSeller = false;
        this.showChangeSeller = false;
        this.sellerChanged.emit(updated);
        this.msg.add({
          severity: 'success',
          summary: 'Vendedor actualizado',
          detail: `Ahora la operación es de ${updated.createdByName ?? '—'}.`,
          life: 3500,
        });
      },
      error: (err: AppError) => {
        this.processingSeller = false;
        this.msg.add({
          severity: err.status === 409 ? 'warn' : 'error',
          summary: err.status === 409 ? 'Advertencia' : 'Error',
          detail: err.message ?? 'No se pudo cambiar el vendedor.',
        });
      },
    });
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
