import { DatePipe, NgClass } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { catchError, of, takeUntil } from 'rxjs';

import { MessageService } from 'primeng/api';
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
import { CashRegisterService } from '../cash-register/cash-register.service';

@Component({
  selector: 'approvals',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    DatePipe,
    NgClass,
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
  ],
  providers: [MessageService],
  templateUrl: './approvals.component.html',
  styleUrl: './approvals.component.scss',
})
export class ApprovalsComponent implements OnInit, OnDestroy {
  private readonly credits = inject(CreditsService);
  private readonly msg = inject(MessageService);
  private readonly cashRegisterSvc = inject(CashRegisterService);
  readonly dateService = inject(DateService);

  approvals: Credit[] = [];
  loading = true;
  processingId: string | null = null;
  isCashClosed = false;

  showApproveDialog = false;
  approvingRow: Credit | null = null;
  approvingDetail: Credit | null = null;
  approveCheckDoc = false;
  approveCheckClient = false;
  approveNote = '';
  approveInstallmentsCount: number | null = null;
  processingApprove = false;

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

  /**
   * Retorna el monto del enganche del crédito aprobado.
   */
  get approvingRowDownPayment(): number {
    return this.approvingDetail?.downPayment ?? this.approvingRow?.downPayment ?? 0;
  }

  /**
   * Cantidad de cuotas adelantadas de la operación en aprobación.
   * @returns {number} Adelanto persistido o cero si no existe.
   */
  get approvingRowPrepaidInstallments(): number {
    return this.approvingDetail?.prepaidInstallments ?? 0;
  }

  /**
   * Método asociado al pago inicial o al adelanto según corresponda.
   * @returns {string | null} Método persistido para mostrar en el modal.
   */
  get approvingRowPaymentMethod(): string | null {
    if (this.approvingRowPrepaidInstallments > 0) {
      return this.approvingDetail?.prepaidInstallmentsMethod ?? null;
    }
    return this.approvingDetail?.downPaymentMethod ?? null;
  }

  /**
   * Traduce el método de pago persistido a una etiqueta legible.
   * @param {string | null} method - Código interno del método.
   * @returns {string} Texto visible en la UI.
   */
  paymentMethodLabel(method: string | null): string {
    if (method === 'TRANSFER') return 'Transferencia';
    if (method === 'CASH') return 'Efectivo';
    return 'Sin especificar';
  }

  /**
   * Indica si la fila en aprobación debe respetar las cuotas ya definidas en origen.
   * @returns {boolean} True para ventas.
   */
  get approvingRowUsesFixedInstallments(): boolean {
    return this.approvingRow?.type === 'SALE';
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
   * Verifica el estado de cierre de caja del día actual.
   */
  private checkCashRegisterStatus(): void {
    this.cashRegisterSvc
      .getDashboard()
      .pipe(
        catchError(() => of(null)),
        takeUntil(this.destroy$),
      )
      .subscribe((dashboard) => {
        this.isCashClosed = dashboard?.isClosed ?? false;
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
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
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
    this.approveCheckDoc = false;
    this.approveCheckClient = false;
    this.approveNote = '';
    this.approveInstallmentsCount = row.installmentsCount;
    this.showApproveDialog = true;
    this.credits.getById(row.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (detail) => {
        this.approvingDetail = detail;
      },
      error: () => {
        this.approvingDetail = row;
      },
    });
  }

  /**
   * Confirma la aprobación de la fila seleccionada. Valida que la caja no esté cerrada.
   * @returns
   */
  confirmApprove(): void {
    if (!this.approvingRow) return;

    if (this.isCashClosed) {
      this.msg.add({
        severity: 'error',
        summary: 'Caja Cerrada',
        detail: 'No puedes aprobar créditos. La caja del día está CERRADA. El crédito + enganche se aprobarán juntos cuando se abra una nueva caja.',
        life: 5000,
      });
      return;
    }

    this.processingApprove = true;
    const row = this.approvingRow;

    const payload =
      !this.approvingRowUsesFixedInstallments &&
      this.approveInstallmentsCount !== null &&
      this.approveInstallmentsCount !== row.installmentsCount
        ? { installmentsCount: this.approveInstallmentsCount }
        : {};

    this.credits
      .approve(row.id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.approvals = this.approvals.filter((a) => a.id !== row.id);
          this.processingApprove = false;
          this.showApproveDialog = false;
          this.approvingRow = null;
          this.approvingDetail = null;
          this.msg.add({
            severity: 'success',
            summary: 'Aprobado',
            detail: `Crédito de ${row.customerName} aprobado. Se generó el cronograma de cuotas.`,
            life: 4000,
          });
        },
        error: (err: { status?: number; message?: string }) => {
          this.processingApprove = false;
          const is409 = err?.status === 409;
          this.msg.add({
            severity: is409 ? 'warn' : 'error',
            summary: is409 ? 'Advertencia' : 'Error',
            detail: err?.message ?? 'No se pudo aprobar. Intentá nuevamente.',
          });
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
   * Confirma el rechazo de la fila seleccionada.
   * @returns
   */
  confirmReject(): void {
    if (this.rejectReason.length < 5 || !this.rejectingRow) return;
    this.processingReject = true;

    this.credits
      .reject(this.rejectingRow.id, { rejectionReason: this.rejectReason })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.approvals = this.approvals.filter(
            (approval) => approval.id !== this.rejectingRow!.id,
          );
          this.processingReject = false;
          this.showRejectDialog = false;
          this.msg.add({
            severity: 'info',
            summary: 'Rechazado',
            detail: `${this.rejectingRow!.customerName} — ${this.rejectReason}`,
            life: 4000,
          });
          this.rejectingRow = null;
        },
        error: (err: { status?: number; message?: string }) => {
          this.processingReject = false;
          const is409 = err?.status === 409;
          this.msg.add({
            severity: is409 ? 'warn' : 'error',
            summary: is409 ? 'Advertencia' : 'Error',
            detail: err?.message ?? 'No se pudo rechazar.',
          });
        },
      });
  }

  /**
   * Devuelve el número de caracteres en el motivo de rechazo.
   * @returns
   */
  rejectCharCount(): number {
    return this.rejectReason.length;
  }
}
