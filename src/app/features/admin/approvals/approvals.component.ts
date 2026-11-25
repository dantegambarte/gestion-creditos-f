import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs';

import { MessageService } from 'primeng/api';
import { DedupMessageService } from '../../../core/services/dedup-message.service';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import { BadgeModule } from 'primeng/badge';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { MessageModule } from 'primeng/message';
import { DateService } from '../../../core/services/date.service';
import { Credit, CreditType } from '../../seller/models/credit.model';
import { CreditsService } from '../../seller/operations/credits.service';
import { CashStatus, CashStatusService } from '../cash-register/cash-status.service';
import { FfBackTopFabComponent } from '../../../shared/components/back-top-fab/ff-back-top-fab.component';
import { UsersService } from '../users/users.service';

@Component({
  selector: 'approvals',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    DatePipe,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    ToastModule,
    SkeletonModule,
    TooltipModule,
    DialogModule,
    CardModule,
    BadgeModule,
    DropdownModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    CheckboxModule,
    MessageModule,
    FfBackTopFabComponent,
  ],
  providers: [{ provide: MessageService, useClass: DedupMessageService }],
  templateUrl: './approvals.component.html',
  styleUrl: './approvals.component.scss',
})
export class ApprovalsComponent implements OnInit, OnDestroy {
  private readonly credits = inject(CreditsService);
  private readonly usersSvc = inject(UsersService);
  private readonly msg = inject(MessageService);
  private readonly cashStatusSvc = inject(CashStatusService);
  private readonly auth = inject(AuthServiceBase);
  private readonly router = inject(Router);
  readonly dateService = inject(DateService);

  approvals: Credit[] = [];
  loading = true;
  processingId: string | null = null;
  cashStatus: CashStatus = 'OPEN';

  /** Indica que no hay caja operativa abierta en la jornada. */
  get isCashClosed(): boolean {
    return this.cashStatus === 'CLOSED';
  }

  /** Indica que no se pudo verificar el estado de caja (falla cerrado). */
  get isCashUnknown(): boolean {
    return this.cashStatus === 'UNKNOWN';
  }

  showApproveDialog = false;
  approvingRow: Credit | null = null;
  approvingDetail: Credit | null = null;
  processingApprove = false;

  // Cambio de vendedor antes de aprobar (solo dentro del diálogo de aprobación).
  showChangeSeller = false;
  sellerOptions: { label: string; value: string }[] = [];
  loadingSellers = false;
  selectedSellerId: string | null = null;
  processingSeller = false;

  showRejectDialog = false;
  rejectingRow: Credit | null = null;
  rejectReason = '';
  processingReject = false;

  searchTerm = '';
  filterType: CreditType | null = null;

  readonly TYPE_OPTIONS = [
    { label: 'Venta', value: 'SALE' as CreditType },
    { label: 'Préstamo', value: 'LOAN' as CreditType },
  ];

  /**
   * Devuelve las aprobaciones filtradas según el término de búsqueda y el tipo seleccionado.
   */
  get filteredApprovals(): Credit[] {
    return this.approvals.filter((a) => {
      const term = this.searchTerm.toLowerCase();
      const matchSearch =
        !term ||
        a.customerName.toLowerCase().includes(term) ||
        (a.createdByName ?? '').toLowerCase().includes(term);
      const matchType = !this.filterType || a.type === this.filterType;
      return matchSearch && matchType;
    });
  }

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.checkCashRegisterStatus();
    this.loadApprovals();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Verifica si hay caja operativa abierta (V4). Ante error de consulta el
   * estado queda UNKNOWN y la aprobación se bloquea.
   */
  private checkCashRegisterStatus(): void {
    this.cashStatusSvc
      .resolve()
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        this.cashStatus = status;
      });
  }

  /**
   * Recarga la lista de aprobaciones pendientes. Se puede llamar después de aprobar o rechazar para actualizar la vista, o usar el botón de recarga manual.
   */
  refresh(): void {
    this.checkCashRegisterStatus();
    this.loadApprovals();
  }

  /**
   * Carga las aprobaciones pendientes desde el servicio. Mientras se cargan, se muestra un indicador de carga. Si ocurre un error, se oculta el indicador y se mantiene la lista anterior (si la hay).
   */
  private loadApprovals(): void {
    this.loading = true;
    this.credits
      .list({ status: 'PENDING_APPROVAL' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.approvals = data;
          this.syncPendingApprovalsBadge(data.length);
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  private syncPendingApprovalsBadge(count: number): void {
    this.auth.patchCurrentUser({ pending_approvals_count: count });
  }

  /**
   * Abre el diálogo de aprobación para la fila seleccionada.
   * @param row
   * @returns
   */
  onApprove(row: Credit): void {
    if (this.processingId) return;
    this.approvingRow = row;
    this.approvingDetail = null;
    this.showChangeSeller = false;
    this.selectedSellerId = null;
    this.showApproveDialog = true;
    this.credits
      .getById(row.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (detail) => {
          this.approvingDetail = detail;
        },
        error: () => {
          this.approvingDetail = row;
        },
      });
  }

  /**
   * Confirma la aprobación de la fila seleccionada. Revalida la caja en vivo
   * (así un backend recuperado desbloquea sin recargar) y actualiza el banner.
   * Toma processingId al empezar para que un doble clic no dispare dos aprobaciones.
   */
  confirmApprove(): void {
    if (!this.approvingRow || this.processingId) return;
    this.processingId = this.approvingRow.id;

    this.cashStatusSvc
      .resolve()
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        this.cashStatus = status;

        if (this.isCashUnknown) {
          this.processingId = null;
          this.msg.add(this.cashStatusSvc.unknownMessage('aprobar créditos'));
          return;
        }

        if (this.isCashClosed) {
          this.processingId = null;
          this.msg.add({
            severity: 'error',
            summary: 'Caja Cerrada',
            detail:
              'No puedes aprobar créditos. La caja del día está CERRADA. El crédito y sus pagos iniciales se aprobarán juntos cuando se abra una nueva caja.',
            life: 5000,
          });
          return;
        }

        this.processApprove();
      });
  }

  /**
   * Envía la aprobación de la fila seleccionada al backend y actualiza la lista.
   * Libera processingId al terminar, con éxito o error.
   */
  private processApprove(): void {
    if (!this.approvingRow) {
      this.processingId = null;
      return;
    }
    this.processingApprove = true;
    const row = this.approvingRow;

    this.credits
      .approve(row.id, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.approvals = this.approvals.filter((a) => a.id !== row.id);
          this.processingApprove = false;
          this.processingId = null;
          this.showApproveDialog = false;
          this.approvingRow = null;
          this.approvingDetail = null;
          this.decrementPendingApprovalsCount();
          this.msg.add({
            severity: 'success',
            summary: 'Aprobado',
            detail: `Crédito de ${row.customerName} aprobado. Se generó el cronograma de cuotas.`,
            life: 4000,
          });
        },
        error: (err: { status?: number; message?: string }) => {
          this.processingApprove = false;
          this.processingId = null;
          this.showRequestError(err, 'No se pudo aprobar. Intentá nuevamente.');
        },
      });
  }

  /** Nombre del vendedor actual de la operación en aprobación. */
  get currentSellerName(): string {
    return this.approvingDetail?.createdByName ?? this.approvingRow?.createdByName ?? '—';
  }

  /** ID del vendedor actual (para preseleccionar y detectar "mismo vendedor"). */
  get currentSellerId(): string | null {
    return this.approvingDetail?.createdById ?? this.approvingRow?.createdById ?? null;
  }

  /**
   * Abre el formulario inline para cambiar el vendedor y carga la lista (1 sola vez).
   */
  openChangeSeller(): void {
    this.selectedSellerId = this.currentSellerId;
    this.showChangeSeller = true;
    if (this.sellerOptions.length === 0) {
      this.loadingSellers = true;
      this.usersSvc
        .list({ roles: 'SELLER,SELLER_COLLECTOR', status: 'ACTIVE' })
        .pipe(takeUntil(this.destroy$))
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

  /** Cierra el formulario de cambio de vendedor sin guardar. */
  cancelChangeSeller(): void {
    this.showChangeSeller = false;
  }

  /**
   * Guarda el nuevo vendedor (PATCH /credits/:id/seller) y refresca la pantalla.
   */
  saveSeller(): void {
    if (!this.approvingRow || !this.selectedSellerId) return;
    if (this.selectedSellerId === this.currentSellerId) {
      this.showChangeSeller = false;
      return;
    }
    this.processingSeller = true;
    const row = this.approvingRow;
    this.credits
      .changeSeller(row.id, this.selectedSellerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          // Refresca el vendedor en el detalle, la fila abierta y la lista.
          if (this.approvingDetail) {
            this.approvingDetail.createdById = updated.createdById;
            this.approvingDetail.createdByName = updated.createdByName;
          }
          row.createdById = updated.createdById;
          row.createdByName = updated.createdByName;
          this.processingSeller = false;
          this.showChangeSeller = false;
          this.msg.add({
            severity: 'success',
            summary: 'Vendedor actualizado',
            detail: `Ahora la operación es de ${updated.createdByName ?? '—'}.`,
            life: 3500,
          });
        },
        error: (err: { status?: number; message?: string }) => {
          this.processingSeller = false;
          this.showRequestError(err, 'No se pudo cambiar el vendedor.');
        },
      });
  }

  /**
   * Abre el diálogo de rechazo para la fila seleccionada.
   * @param row
   * @returns
   */
  onReject(row: Credit): void {
    if (this.processingId) return;
    this.rejectingRow = row;
    this.rejectReason = '';
    this.showRejectDialog = true;
  }

  /**
   * Confirma el rechazo de la fila seleccionada con el motivo recortado.
   * Exige al menos 5 caracteres reales y bloquea reentradas vía processingId.
   */
  confirmReject(): void {
    const reason = this.rejectReason.trim();
    if (reason.length < 5 || !this.rejectingRow || this.processingId) return;
    this.processingReject = true;
    this.processingId = this.rejectingRow.id;

    this.credits
      .reject(this.rejectingRow.id, { rejectionReason: reason })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.approvals = this.approvals.filter(
            (approval) => approval.id !== this.rejectingRow!.id,
          );
          this.processingReject = false;
          this.processingId = null;
          this.showRejectDialog = false;
          this.decrementPendingApprovalsCount();
          this.msg.add({
            severity: 'info',
            summary: 'Rechazado',
            detail: `${this.rejectingRow!.customerName} — ${reason}`,
            life: 4000,
          });
          this.rejectingRow = null;
        },
        error: (err: { status?: number; message?: string }) => {
          this.processingReject = false;
          this.processingId = null;
          this.showRequestError(err, 'No se pudo rechazar.');
        },
      });
  }

  /**
   * Muestra el toast de error de una request: advertencia si es conflicto (409), error en otro caso.
   * @param err - error devuelto por el backend
   * @param fallback - mensaje a usar si el backend no envía uno
   */
  private showRequestError(err: { status?: number; message?: string }, fallback: string): void {
    const is409 = err?.status === 409;
    this.msg.add({
      severity: is409 ? 'warn' : 'error',
      summary: is409 ? 'Advertencia' : 'Error',
      detail: err?.message ?? fallback,
    });
  }

  private decrementPendingApprovalsCount(): void {
    const currentCount = this.auth.snapshot?.pending_approvals_count;
    if (currentCount === undefined || currentCount === null) return;
    this.auth.patchCurrentUser({
      pending_approvals_count: Math.max(currentCount - 1, 0),
    });
  }

  /**
   * Devuelve los caracteres reales del motivo de rechazo (sin espacios en los extremos).
   */
  rejectCharCount(): number {
    return this.rejectReason.trim().length;
  }

  /**
   * Navega al detalle de la operación seleccionada.
   * @param {string} id - ID de la operación.
   */
  viewDetail(id: string): void {
    this.router.navigate(['/admin/operations', id]);
  }
}
