import { CommonModule, DatePipe, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { AuthServiceBase } from '../../../../core/auth/auth-service.base';
import { AppError } from '../../../../core/models/app-error';
import { FormatService } from '../../../../core/services/format.service';
import { HeaderService } from '../../../../core/services/header.service';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import {
  CreditDetail,
  CreditStatus,
  CreditUnit,
  InstallmentStatus,
  RefinanceResult,
  SimulateResult,
} from '../../models/credit.model';
import {
  ApplyPenaltyPayload,
  EarlyPayPayload,
  Installment,
} from '../../models/installment.model';
import { CreditsService } from '../credits.service';
import { InstallmentsService } from '../installments.service';
import { CreditPayment } from '../../../collector/models/payment.model';
import { PaymentsService } from '../../../collector/payments.service';

@Component({
  selector: 'app-credit-detail',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    DatePipe,
    CommonModule,
    FormsModule,
    ButtonModule,
    TagModule,
    TableModule,
    ToastModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    InputNumberModule,
    InputTextareaModule,
    TooltipModule,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  providers: [MessageService],
  templateUrl: './credit-detail.component.html',
})
export class CreditDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly creditsService = inject(CreditsService);
  private readonly installmentsService = inject(InstallmentsService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly location = inject(Location);
  private readonly header = inject(HeaderService);
  readonly auth = inject(AuthServiceBase);
  private readonly msg = inject(MessageService);
  private readonly fmt = inject(FormatService);

  credit: CreditDetail | null = null;
  loading = false;
  error: AppError | null = null;

  selectedInstallment: CreditDetail['installments'][number] | null = null;
  activeTab: 'all' | 'paid' | 'pending' | 'overdue' = 'all';

  // ── Panel principal: cronograma vs cobros ─────────────────────
  mainTab: 'installments' | 'payments' = 'installments';
  creditPayments: CreditPayment[] = [];
  loadingPayments = false;
  paymentsLoaded = false;

  // ── Cobro directo desde cuota ──────────────────────────────────
  showDirectDialog = false;
  directInstallmentId = '';
  directMaxAmount = 0;
  directAmount: number | null = null;
  directMethod: 'CASH' | 'TRANSFER' = 'CASH';
  directTransferRef = '';
  directNotes = '';
  processingDirect = false;

  get paidCount(): number {
    return this.credit?.installments.filter((i) => i.status === 'PAID').length ?? 0;
  }

  get pendingCount(): number {
    return this.credit?.installments.filter((i) => i.status === 'PENDING' || i.status === 'PARTIAL').length ?? 0;
  }

  get overdueCount(): number {
    return this.credit?.installments.filter((i) => i.status === 'OVERDUE').length ?? 0;
  }

  get installmentAmount(): number | null {
    return this.credit?.installments[0]?.amountDue ?? null;
  }

  /**
   * Selecciona o deselecciona una cuota para mostrar el panel lateral de detalle.
   * @param {CreditDetail['installments'][number]} inst - Cuota clickeada.
   */
  selectInstallment(inst: CreditDetail['installments'][number]): void {
    this.selectedInstallment = this.selectedInstallment?.id === inst.id ? null : inst;
  }

  showApproveDialog = false;
  approveInstallmentsCount: number | null = null;
  processingApprove = false;

  showRejectDialog = false;
  rejectReason = '';
  processingReject = false;

  showSettlementDialog = false;
  settlementPaymentMethod: 'CASH' | 'TRANSFER' = 'CASH';
  settlementTransferRef = '';
  processingSettlement = false;

  readonly PAYMENT_METHOD_OPTIONS = [
    { label: 'Efectivo', value: 'CASH' },
    { label: 'Transferencia', value: 'TRANSFER' },
  ];

  readonly FREQUENCY_OPTIONS = [
    { label: 'Mensual', value: 'MONTHLY' },
    { label: 'Quincenal', value: 'BIWEEKLY' },
    { label: 'Semanal', value: 'WEEKLY' },
  ];

  showPenaltyDialog = false;
  penaltyInstallment: CreditDetail['installments'][number] | null = null;
  penaltyAmount: number | null = null;
  penaltyReason = '';
  processingPenalty = false;

  showWaiveDialog = false;
  waiveInstallment: CreditDetail['installments'][number] | null = null;
  processingWaive = false;

  showEarlyPayDialog = false;
  earlyPayInstallment: CreditDetail['installments'][number] | null = null;
  earlyPayMethod: 'CASH' | 'TRANSFER' = 'CASH';
  earlyPayTransferRef = '';
  processingEarlyPay = false;

  // ── Refinanciación ────────────────────────────────────────────
  showRefinanceDialog = false;
  refinanceStep: 1 | 2 = 1;
  refinanceInstallmentsCount: number | null = null;
  refinanceFrequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' = 'MONTHLY';
  refinanceReason = '';
  refinanceExtraCharges: number | null = null;
  refinanceNotes = '';
  refinanceSimulation: SimulateResult | null = null;
  refinanceSimulating = false;
  refinanceResult: RefinanceResult | null = null;
  processingRefinance = false;

  /**
   * Verifica si el usuario actual es un administrador.
   * @returns
   */
  get isAdmin(): boolean {
    return this.auth.hasRole('ADMIN');
  }

  /** Un crédito REFINANCED o SETTLED no acepta más acciones sobre sus cuotas. */
  get canActOnInstallments(): boolean {
    return this.isAdmin &&
      this.credit?.status !== 'REFINANCED' &&
      this.credit?.status !== 'SETTLED';
  }

  /**
   * Devuelve el número de caracteres restantes para el campo de razón de rechazo.
   * @returns
   */
  rejectCharCount(): number {
    return this.rejectReason.length;
  }

  /**
   * Obtiene el ID del crédito desde la URL, extrayéndolo de los parámetros de la ruta utilizando ActivatedRoute. Se asume que la ruta está configurada para incluir un parámetro llamado 'id'. El operador non-null assertion (`!`) se utiliza para indicar que se espera que este valor siempre esté presente en la URL.
   */
  private get creditId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit(): void {
    this.header.set([
      { label: 'Operaciones', route: '/seller/operations' },
      { label: 'Detalle' },
    ]);
    this.route.paramMap.subscribe(() => {
      this.credit = null;
      this.selectedInstallment = null;
      this.mainTab = 'installments';
      this.paymentsLoaded = false;
      this.creditPayments = [];
      this.load();
    });
  }

  goBack(): void {
    this.location.back();
  }

  /**
   * Devuelve la etiqueta correspondiente a la variante de la unidad.
   * @param u
   * @returns
   */
  variantLabel(u: CreditUnit): string {
    const parts = [u.color, u.size, u.capacity].filter((s) => !!s);
    return parts.length > 0 ? parts.join(' / ') : '—';
  }

  /**
   * Devuelve la etiqueta correspondiente al estado del crédito.
   * @param status
   * @returns
   */
  statusLabel(status: CreditStatus): string {
    const map: Record<CreditStatus, string> = {
      PENDING_APPROVAL: 'Pendiente de aprobación',
      ACTIVE: 'Activo',
      SETTLED: 'Liquidado',
      REJECTED: 'Rechazado',
      REFINANCED: 'Refinanciado',
    };
    return map[status];
  }

  /**
   * Devuelve el nivel de severidad correspondiente al estado del crédito.
   * @param status
   * @returns
   */
  statusSeverity(
    status: CreditStatus,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    const map: Record<
      CreditStatus,
      'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast'
    > = {
      PENDING_APPROVAL: 'warning',
      ACTIVE: 'success',
      SETTLED: 'secondary',
      REJECTED: 'danger',
      REFINANCED: 'contrast',
    };
    return map[status];
  }

  /**
   * Devuelve el nivel de severidad correspondiente al estado de la cuota.
   * @param status
   * @returns
   */
  installmentSeverity(
    status: InstallmentStatus,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    const map: Record<
      InstallmentStatus,
      'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast'
    > = {
      PENDING: 'info',
      PAID: 'success',
      OVERDUE: 'danger',
      PARTIAL: 'warning',
    };
    return map[status] ?? 'secondary';
  }

  /**
   * Devuelve la etiqueta correspondiente al estado de la cuota.
   * @param status
   * @returns
   */
  installmentLabel(status: InstallmentStatus): string {
    const map: Record<InstallmentStatus, string> = {
      PENDING: 'Pendiente',
      PAID: 'Pagada',
      OVERDUE: 'Vencida',
      PARTIAL: 'Parcial',
    };
    return map[status] ?? status;
  }

  /**
   * Devuelve la etiqueta correspondiente a la frecuencia de pago.
   * @param frequency
   * @returns
   */
  frequencyLabel(frequency: string): string {
    const map: Record<string, string> = {
      WEEKLY: 'Semanal',
      BIWEEKLY: 'Quincenal',
      MONTHLY: 'Mensual',
    };
    return map[frequency] ?? frequency;
  }

  /**
   * Carga los detalles del crédito desde el backend utilizando el servicio CreditsService. Maneja los estados de carga y error, y actualiza la propiedad credit con los datos obtenidos.
   */
  openApproveDialog(): void {
    this.approveInstallmentsCount = this.credit?.installmentsCount ?? null;
    this.showApproveDialog = true;
  }

  /**
   * Confirma la aprobación del crédito.
   * @returns
   */
  confirmApprove(): void {
    if (!this.credit) return;
    this.processingApprove = true;
    const payload =
      this.approveInstallmentsCount !== null &&
      this.approveInstallmentsCount !== this.credit.installmentsCount
        ? { installmentsCount: this.approveInstallmentsCount }
        : {};

    this.creditsService.approve(this.credit.id, payload).subscribe({
      next: (updated) => {
        this.credit = updated;
        this.processingApprove = false;
        this.showApproveDialog = false;
        this.msg.add({
          severity: 'success',
          summary: 'Aprobado',
          detail: 'Crédito aprobado. Cuotas generadas correctamente.',
          life: 4000,
        });
      },
      error: (err: AppError) => {
        this.processingApprove = false;
        this.msg.add({
          severity: err.status === 409 ? 'warn' : 'error',
          summary: err.status === 409 ? 'Advertencia' : 'Error',
          detail: err.message ?? 'No se pudo aprobar.',
        });
      },
    });
  }

  /**
   * Abre el diálogo para rechazar el crédito, reseteando el motivo de rechazo y mostrando el diálogo.
   */
  openRejectDialog(): void {
    this.rejectReason = '';
    this.showRejectDialog = true;
  }

  /**
   * Confirma el rechazo del crédito.
   * @returns
   */
  confirmReject(): void {
    if (!this.credit || this.rejectReason.length < 5) return;
    this.processingReject = true;

    this.creditsService
      .reject(this.credit.id, { rejectionReason: this.rejectReason })
      .subscribe({
        next: () => {
          this.processingReject = false;
          this.showRejectDialog = false;
          this.msg.add({
            severity: 'info',
            summary: 'Rechazado',
            detail: 'Crédito rechazado.',
            life: 4000,
          });
          this.load();
        },
        error: (err: AppError) => {
          this.processingReject = false;
          this.msg.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary: err.status === 409 ? 'Advertencia' : 'Error',
            detail: err.message ?? 'No se pudo rechazar.',
          });
        },
      });
  }

  /**
   * Abre el diálogo para la cancelación anticipada del crédito, reseteando los campos relacionados y mostrando el diálogo.
   */
  openSettlementDialog(): void {
    this.settlementPaymentMethod = 'CASH';
    this.settlementTransferRef = '';
    this.showSettlementDialog = true;
  }

  /**
   * Confirma la cancelación anticipada del crédito.
   * @returns
   */
  confirmSettlement(): void {
    if (!this.credit) return;
    this.processingSettlement = true;

    const payload = {
      paymentMethod: this.settlementPaymentMethod,
      ...(this.settlementPaymentMethod === 'TRANSFER' &&
      this.settlementTransferRef
        ? { transferReference: this.settlementTransferRef }
        : {}),
    };

    this.creditsService.earlySettlement(this.credit.id, payload).subscribe({
      next: (result) => {
        this.processingSettlement = false;
        this.showSettlementDialog = false;
        const formatted = this.fmt.currency(result.settlementAmount, 2);
        this.msg.add({
          severity: 'success',
          summary: 'Cancelación anticipada',
          detail: `Procesada correctamente. Monto: ${formatted}`,
          life: 6000,
        });
        this.load();
      },
      error: (err: AppError) => {
        this.processingSettlement = false;
        this.msg.add({
          severity: err.status === 409 ? 'warn' : 'error',
          summary: err.status === 409 ? 'Advertencia' : 'Error',
          detail: err.message ?? 'No se pudo procesar.',
        });
      },
    });
  }

  /**
   * Abre el diálogo para aplicar una mora a una cuota, reseteando los campos relacionados y mostrando el diálogo.
   * @param inst
   */
  openPenaltyDialog(inst: CreditDetail['installments'][number]): void {
    this.penaltyInstallment = inst;
    this.penaltyAmount = null;
    this.penaltyReason = '';
    this.showPenaltyDialog = true;
  }

  /**
   * Confirma la aplicación de la mora a una cuota.
   * @returns
   */
  confirmApplyPenalty(): void {
    if (
      !this.penaltyInstallment ||
      !this.penaltyAmount ||
      this.penaltyAmount <= 0
    )
      return;
    this.processingPenalty = true;

    const payload: ApplyPenaltyPayload = { penaltyAmount: this.penaltyAmount };
    if (this.penaltyReason) payload.reason = this.penaltyReason;

    this.installmentsService
      .applyPenalty(this.penaltyInstallment.id, payload)
      .subscribe({
        next: (updated) => {
          this.processingPenalty = false;
          this.showPenaltyDialog = false;
          this.updateInstallmentInList(updated);
          this.msg.add({
            severity: 'success',
            summary: 'Mora aplicada',
            detail: 'La mora fue aplicada a la cuota.',
            life: 3000,
          });
        },
        error: (err: AppError) => {
          this.processingPenalty = false;
          this.msg.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary: err.status === 409 ? 'Advertencia' : 'Error',
            detail: err.message ?? 'No se pudo aplicar mora.',
          });
        },
      });
  }

  /**
   * Abre el diálogo para condonar una mora, reseteando los campos relacionados y mostrando el diálogo.
   * @param inst
   */
  openWaiveDialog(inst: CreditDetail['installments'][number]): void {
    this.waiveInstallment = inst;
    this.showWaiveDialog = true;
  }

  /**
   * Confirma la condonación de la mora a una cuota.
   * @returns
   */
  confirmWaivePenalty(): void {
    if (!this.waiveInstallment) return;
    this.processingWaive = true;

    this.installmentsService.waivePenalty(this.waiveInstallment.id).subscribe({
      next: (updated) => {
        this.processingWaive = false;
        this.showWaiveDialog = false;
        this.updateInstallmentInList(updated);
        this.msg.add({
          severity: 'success',
          summary: 'Mora condonada',
          detail: 'La mora fue condonada.',
          life: 3000,
        });
      },
      error: (err: AppError) => {
        this.processingWaive = false;
        this.msg.add({
          severity: err.status === 409 ? 'warn' : 'error',
          summary: err.status === 409 ? 'Advertencia' : 'Error',
          detail: err.message ?? 'No se pudo condonar mora.',
        });
      },
    });
  }

  /**
   * Abre el diálogo para el pago anticipado de una cuota, reseteando los campos relacionados y mostrando el diálogo.
   */
  openEarlyPayDialog(inst: CreditDetail['installments'][number]): void {
    this.earlyPayInstallment = inst;
    this.earlyPayMethod = 'CASH';
    this.earlyPayTransferRef = '';
    this.showEarlyPayDialog = true;
  }

  /**
   * Confirma el pago anticipado de una cuota.
   * @returns
   */
  confirmEarlyPay(): void {
    if (!this.earlyPayInstallment) return;
    this.processingEarlyPay = true;

    const payload: EarlyPayPayload = { paymentMethod: this.earlyPayMethod };
    if (this.earlyPayMethod === 'TRANSFER' && this.earlyPayTransferRef) {
      payload.transferReference = this.earlyPayTransferRef;
    }

    this.installmentsService
      .earlyPay(this.earlyPayInstallment.id, payload)
      .subscribe({
        next: (result) => {
          this.processingEarlyPay = false;
          this.showEarlyPayDialog = false;

          if (result.creditSettled) {
            this.msg.add({
              severity: 'success',
              summary: 'Crédito liquidado',
              detail: 'El crédito quedó liquidado completamente.',
              life: 6000,
            });
            this.load();
          } else {
            this.updateInstallmentInList({
              id: result.id,
              amountDue: result.amountDue,
              amountPaid: result.amountPaid,
              penaltyAmount: result.penaltyAmount,
              status: result.status,
            });
            this.msg.add({
              severity: 'success',
              summary: 'Pago anticipado',
              detail: 'Cuota pagada anticipadamente.',
              life: 3000,
            });
          }
        },
        error: (err: AppError) => {
          this.processingEarlyPay = false;
          this.msg.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary: err.status === 409 ? 'Advertencia' : 'Error',
            detail: err.message ?? 'No se pudo procesar el pago.',
          });
        },
      });
  }

  /**
   * Actualiza una cuota en la lista de cuotas del crédito, reemplazando la cuota con el mismo ID por la versión actualizada. Se utiliza para reflejar los cambios después de aplicar o condonar una mora, o realizar un pago anticipado.
   */
  private updateInstallmentInList(updated: Partial<Installment>): void {
    if (!this.credit || !updated.id) return;
    this.credit = {
      ...this.credit,
      installments: this.credit.installments.map((inst) =>
        inst.id === updated.id ? { ...inst, ...updated } : inst,
      ),
    };
  }

  /**
   * Devuelve la etiqueta del método de pago.
   */
  paymentMethodLabel(method: 'CASH' | 'TRANSFER'): string {
    return method === 'CASH' ? 'Efectivo' : 'Transferencia';
  }

  get directFormValid(): boolean {
    return (
      this.directInstallmentId.length > 0 &&
      (this.directAmount ?? 0) > 0 &&
      (this.directAmount ?? 0) <= this.directMaxAmount &&
      (this.directMethod !== 'TRANSFER' || this.directTransferRef.trim().length > 0)
    );
  }

  /**
   * Abre el dialog de cobro directo pre-cargado con la cuota seleccionada.
   * @param inst - Cuota sobre la que se va a cobrar.
   */
  openDirectDialog(inst: CreditDetail['installments'][number]): void {
    this.directInstallmentId = inst.id;
    this.directMaxAmount = inst.amountDue - inst.amountPaid;
    this.directAmount = this.directMaxAmount;
    this.directMethod = 'CASH';
    this.directTransferRef = '';
    this.directNotes = '';
    this.showDirectDialog = true;
  }

  confirmDirect(): void {
    if (!this.directFormValid) return;
    this.processingDirect = true;
    this.paymentsService
      .adminDirect({
        installmentId: this.directInstallmentId,
        amountReceived: this.directAmount!,
        paymentMethod: this.directMethod,
        transferReference: this.directTransferRef || undefined,
        notes: this.directNotes || undefined,
      })
      .subscribe({
        next: () => {
          this.processingDirect = false;
          this.showDirectDialog = false;
          this.paymentsLoaded = false; // fuerza recarga del tab de cobros
          this.msg.add({
            severity: 'success',
            summary: 'Cobro registrado',
            detail: 'El cobro fue registrado y aprobado correctamente.',
            life: 5000,
          });
          this.load();
        },
        error: (err: AppError) => {
          this.processingDirect = false;
          this.msg.add({
            severity: err.status === 409 || err.status === 422 ? 'warn' : 'error',
            summary: err.status === 409 || err.status === 422 ? 'Advertencia' : 'Error',
            detail: err.message ?? 'No se pudo registrar el cobro.',
          });
        },
      });
  }

  /**
   * Cambia al tab de cobros y carga el historial si aún no fue cargado.
   */
  switchToPayments(): void {
    this.mainTab = 'payments';
    if (this.paymentsLoaded) return;
    this.loadingPayments = true;
    this.paymentsService.listByCredit(this.creditId).subscribe({
      next: (data) => {
        this.creditPayments = data;
        this.loadingPayments = false;
        this.paymentsLoaded = true;
      },
      error: () => {
        this.loadingPayments = false;
      },
    });
  }

  // ── Refinanciación ────────────────────────────────────────────

  /** Saldo pendiente del crédito: suma de cuotas no pagadas. */
  get refinancePendingBalance(): number {
    if (!this.credit) return 0;
    return Math.round(
      this.credit.installments
        .filter((i) => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(i.status))
        .reduce((sum, i) => sum + (i.amountDue - i.amountPaid), 0) * 100,
    ) / 100;
  }

  /** Total trasladado: saldo + cargos adicionales opcionales. */
  get refinanceTotalTransferred(): number {
    return Math.round(
      (this.refinancePendingBalance + (this.refinanceExtraCharges ?? 0)) * 100,
    ) / 100;
  }

  /** ID del crédito predecesor (el que fue refinanciado para crear este). */
  get predecessorCreditId(): string | null {
    return this.credit?.refinancingChain?.predecessorId ?? null;
  }

  /** ID del crédito sucesor (el creado al refinanciar este). */
  get successorCreditId(): string | null {
    return this.credit?.refinancingChain?.successorId ?? null;
  }

  /** Navega al crédito de la cadena preservando el contexto admin/seller. */
  navigateToChainCredit(id: string): void {
    const segments = this.router.url.split('/');
    const base = `/${segments[1]}/${segments[2]}`;
    this.router.navigate([base, id]);
  }

  get refinanceStep1Valid(): boolean {
    return (
      (this.refinanceInstallmentsCount ?? 0) >= 1 &&
      (this.refinanceInstallmentsCount ?? 0) <= 120 &&
      this.refinanceReason.trim().length >= 5
    );
  }

  /**
   * Abre el wizard de refinanciación reseteando todos los campos.
   */
  openRefinanceDialog(): void {
    this.refinanceStep = 1;
    this.refinanceInstallmentsCount = null;
    this.refinanceFrequency = 'MONTHLY';
    this.refinanceReason = '';
    this.refinanceExtraCharges = null;
    this.refinanceNotes = '';
    this.refinanceSimulation = null;
    this.refinanceResult = null;
    this.showRefinanceDialog = true;
  }

  /**
   * Paso 1 → 2: simula el nuevo crédito con el saldo pendiente.
   */
  goToRefinanceStep2(): void {
    if (!this.refinanceStep1Valid || !this.credit) return;
    this.refinanceSimulating = true;
    this.creditsService
      .simulate({
        type: 'LOAN',
        totalAmount: this.refinanceTotalTransferred,
        installmentsCount: this.refinanceInstallmentsCount!,
        paymentFrequency: this.refinanceFrequency,
      })
      .subscribe({
        next: (result) => {
          this.refinanceSimulation = result;
          this.refinanceSimulating = false;
          this.refinanceStep = 2;
        },
        error: (err: AppError) => {
          this.refinanceSimulating = false;
          this.msg.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary: err.status === 409 ? 'Sin tasa' : 'Error',
            detail: err.message ?? 'No se pudo simular con los parámetros indicados.',
          });
        },
      });
  }

  /**
   * Confirma y ejecuta la refinanciación. El nuevo crédito queda en PENDING_APPROVAL.
   */
  confirmRefinance(): void {
    if (!this.credit || !this.refinanceStep1Valid) return;
    this.processingRefinance = true;
    this.creditsService
      .refinance(this.credit.id, {
        installmentsCount: this.refinanceInstallmentsCount!,
        paymentFrequency: this.refinanceFrequency,
        reason: this.refinanceReason.trim(),
        extraCharges: this.refinanceExtraCharges ?? undefined,
        notes: this.refinanceNotes || undefined,
      })
      .subscribe({
        next: (result) => {
          this.processingRefinance = false;
          this.refinanceResult = result;
          this.showRefinanceDialog = false;
          this.msg.add({
            severity: 'success',
            summary: 'Refinanciación creada',
            detail: `Nuevo crédito generado (${this.fmt.currency(result.totalTransferred, 2)}) pendiente de aprobación.`,
            life: 7000,
          });
          this.load();
        },
        error: (err: AppError) => {
          this.processingRefinance = false;
          this.msg.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary: err.status === 409 ? 'Advertencia' : 'Error',
            detail: err.message ?? 'No se pudo crear la refinanciación.',
          });
        },
      });
  }

  /**
   * Carga los detalles del crédito desde el backend utilizando el servicio CreditsService. Maneja los estados de carga y error, y actualiza la propiedad credit con los datos obtenidos. También actualiza el encabezado de la página con el nombre del cliente y el tipo de crédito.
   */
  load(): void {
    this.loading = true;
    this.error = null;
    this.creditsService.getById(this.creditId).subscribe({
      next: (data) => {
        this.credit = data;
        this.header.set([
          { label: 'Operaciones', route: '/seller/operations' },
          {
            label: `${data.type === 'SALE' ? 'Venta' : 'Préstamo'} — ${data.customerName}`,
          },
        ]);
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }
}
