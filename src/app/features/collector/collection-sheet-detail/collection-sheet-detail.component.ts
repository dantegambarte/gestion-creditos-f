import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { AppError } from '../../../core/models/app-error';
import { HeaderService } from '../../../core/services/header.service';
import { ErrorStateComponent } from '../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/states/loading-state/loading-state.component';
import { InstallmentStatus } from '../../seller/models/installment.model';
import { InstallmentsService } from '../../seller/operations/installments.service';
import { CollectionAttemptsService } from '../collection-attempts.service';
import { CollectionsService } from '../collections.service';
import {
  ANTECEDENT_TYPE_LABELS,
  AntecedentType,
  COLLECTION_FILTER_LABELS,
  CollectionSheetDetail,
  CollectionSheetItem,
  ManagementStatus,
} from '../models/collection.model';
import {
  CollectionAttemptCreatePayload,
  CollectionAttemptType,
} from '../models/collection-attempt.model';
import {
  MANAGEMENT_EVENT_LABELS,
  ManagementEventType,
  ManagementLogEntry,
} from '../models/management-log.model';
import { PaymentCreatePayload } from '../models/payment.model';
import { PaymentsService } from '../payments.service';
import { AppRoutes } from '../../../shared/models/enums/routes.enum';
import { CurrencyAmountInputDirective } from '../../../shared/directives/currency-amount-input.directive';

@Component({
  selector: 'app-collection-sheet-detail',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    DatePipe,
    FormsModule,
    ButtonModule,
    CalendarModule,
    TagModule,
    BadgeModule,
    ToastModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    InputTextareaModule,
    CurrencyAmountInputDirective,
    ProgressSpinnerModule,
    TooltipModule,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  providers: [MessageService],
  templateUrl: './collection-sheet-detail.component.html',
  styleUrl: './collection-sheet-detail.component.scss',
})
export class CollectionSheetDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly collectionsService = inject(CollectionsService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly attemptsService = inject(CollectionAttemptsService);
  private readonly installmentsService = inject(InstallmentsService);
  private readonly router = inject(Router);
  private readonly header = inject(HeaderService);
  private readonly msg = inject(MessageService);

  sheet: CollectionSheetDetail | null = null;
  items: CollectionSheetItem[] = [];
  selectedItem: CollectionSheetItem | null = null;
  sidePanelOpen = false;
  loading = true;
  error: AppError | null = null;

  /** Tab activa del listado: todas, con mora, o con pre-carga pendiente. */
  activeTab: 'ALL' | 'OVERDUE' | 'PENDING_PAYMENT' = 'ALL';

  /** ID de la cuota cuyo refresh silencioso está en curso (spinner local). */
  processingItemId: string | null = null;

  // ── Panel cronológico (management log) por cuota ─────────────────────────────
  /** installmentId cuyo log está abierto en el panel expandido (uno a la vez). */
  expandedLogItemId: string | null = null;
  /** Cache de logs ya descargados, por installmentId. */
  managementLogs: Record<string, ManagementLogEntry[]> = {};
  /** installmentId del log que está cargándose en este momento. */
  loadingLogItemId: string | null = null;

  // ── Diálogo de cobro ─────────────────────────────────────────────────────────
  showPaymentDialog = false;
  dialogItem: CollectionSheetItem | null = null;
  paymentAmount: number | null = null;
  paymentMethod: 'CASH' | 'TRANSFER' = 'CASH';
  transferReference = '';
  paymentNotes = '';
  /** Fecha ISO 'YYYY-MM-DD' del input nativo type="date". */
  paymentNextVisitDate = '';
  processingPayment = false;

  // ── Diálogo de intento (NO_PAYMENT / NOT_FOUND) ──────────────────────────────
  showAttemptDialog = false;
  attemptItem: CollectionSheetItem | null = null;
  attemptType: CollectionAttemptType = 'NO_PAYMENT';
  attemptReason = '';
  attemptNextVisitDate = '';
  attemptNotes = '';
  processingAttempt = false;
  readonly todayDate = new Date();

  // ── Diálogo de anulación (void) ──────────────────────────────────────────────
  showVoidDialog = false;
  voidItem: CollectionSheetItem | null = null;
  processingVoid = false;

  readonly PAYMENT_METHOD_OPTIONS = [
    { label: 'Efectivo', value: 'CASH' },
    { label: 'Transferencia', value: 'TRANSFER' },
  ];

  /** Hoy en formato 'YYYY-MM-DD' — bloquea fechas pasadas en input type="date". */
  readonly todayIso = new Date().toISOString().split('T')[0];

  private get sheetId(): string {
    return this.route.snapshot.paramMap.get('sheetId')!;
  }

  ngOnInit(): void {
    this.header.set([
      { label: 'Mi Ruta', route: AppRoutes.ROUTE },
      { label: 'Planilla' },
    ]);
    this.load();
  }

  goBack(): void {
    this.router.navigate([AppRoutes.COLLECTOR, 'route']);
  }

  filterLabel(f: string): string {
    return (
      COLLECTION_FILTER_LABELS[f as keyof typeof COLLECTION_FILTER_LABELS] ?? f
    );
  }

  antecedentLabel(t: AntecedentType): string {
    return ANTECEDENT_TYPE_LABELS[t];
  }

  /** Etiqueta de la gestión del día derivada del management_status vivo. */
  managementLabel(status: ManagementStatus): string {
    const map: Record<ManagementStatus, string> = {
      PENDING: 'Pendiente',
      VISITED: 'Cobro registrado',
      PAID: 'Cobrada',
      NO_PAYMENT: 'No pagó',
      NOT_FOUND: 'No encontrado',
    };
    return map[status] ?? status;
  }

  installmentSeverity(
    status: InstallmentStatus,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    const map: Record<
      InstallmentStatus,
      'success' | 'info' | 'warning' | 'danger' | 'secondary'
    > = {
      PENDING: 'info',
      OVERDUE: 'danger',
      PAID: 'success',
      PARTIAL: 'warning',
    };
    return map[status] ?? 'secondary';
  }

  installmentLabel(status: InstallmentStatus): string {
    const map: Record<InstallmentStatus, string> = {
      PENDING: 'Pendiente',
      OVERDUE: 'Vencida',
      PAID: 'Pagada',
      PARTIAL: 'Parcial',
    };
    return map[status] ?? status;
  }

  // ── Montos a mostrar/cobrar ──────────────────────────────────────────────────
  // El cobro es una operación VIVA: se cobra el saldo actual de la cuota (con
  // mora), no el snapshot congelado al generar. Si usáramos el snapshot, el
  // cobrador pagaría un monto que el backend ve como parcial (la mora subió el
  // saldo) y rechazaría con 422. En planillas read-only (live=null) caemos al
  // snapshot, correcto para el documento histórico.

  /** Monto a cobrar vivo de la cuota (con mora). Snapshot como fallback. */
  displayAmountDue(item: CollectionSheetItem): number {
    return item.live?.amountDue ?? item.amountDue;
  }

  /** Mora viva acumulada. Snapshot como fallback. */
  displayPenalty(item: CollectionSheetItem): number {
    return item.live?.penaltyAmount ?? item.penaltyAmount;
  }

  /** Monto ya pagado vivo. Snapshot como fallback. */
  displayAmountPaid(item: CollectionSheetItem): number {
    return item.live?.amountPaid ?? item.amountPaid;
  }

  /** Capital de la cuota sin mora (monto vivo − mora viva). */
  displayCapital(item: CollectionSheetItem): number {
    return Math.max(0, this.displayAmountDue(item) - this.displayPenalty(item));
  }

  availableBalance(item: CollectionSheetItem): number {
    return Math.max(0, this.displayAmountDue(item) - this.displayAmountPaid(item));
  }

  /** True si una acción está en curso sobre esta cuota (refresh silencioso). */
  isItemProcessing(item: CollectionSheetItem): boolean {
    return this.processingItemId === item.installmentId;
  }

  /**
   * True si la planilla es operable hoy. El backend adjunta la capa `live` solo
   * a planillas ACTIVE del día; si es null, es un documento read-only (cerrada,
   * regenerada o de otra fecha) y no se permite ninguna gestión.
   */
  isOperable(item: CollectionSheetItem): boolean {
    return item.live !== null;
  }

  /**
   * Reglas para "Cobrar":
   *  - planilla operable hoy, cuota no saldada, no en procesamiento, sin
   *    pre-carga viva pendiente.
   *  - Mantenido habilitado incluso tras un intento del día: si el cliente
   *    aparece con plata después de marcar "no pagó/no encontrado", el cobrador
   *    debe poder registrar el cobro.
   */
  canRegisterPayment(item: CollectionSheetItem): boolean {
    if (!this.isOperable(item)) return false;
    if (item.managementStatus === 'PAID') return false;
    if (this.isItemProcessing(item)) return false;
    if (item.live!.hasPendingPayment) return false;
    return true;
  }

  /**
   * Reglas para "No pagó" / "No encontrado":
   *  - todas las del cobro, PLUS no se permite si ya hubo una gestión del día.
   *  - Tras un cobro (parcial o total) del día, también se bloquean (la
   *    reversión va por el flujo admin existente).
   */
  canRegisterAttempt(item: CollectionSheetItem): boolean {
    if (!this.canRegisterPayment(item)) return false;
    if (this.alreadyManagedToday(item)) return false;
    return true;
  }

  /**
   * True si esta cuota ya tiene una gestión registrada hoy. Se deriva del
   * management_status vivo: deja de ser PENDING cuando hubo cobro o intento.
   */
  alreadyManagedToday(item: CollectionSheetItem): boolean {
    return item.managementStatus !== 'PENDING';
  }

  /**
   * True si la gestión viva del día es un intento (NO_PAYMENT/NOT_FOUND) y por
   * lo tanto puede anularse desde la UI del cobrador. Los cobros se revierten
   * desde el flujo de admin. Usa la capa live (today_attempt_id), no el
   * antecedente congelado del snapshot.
   */
  canVoidTodayAttempt(item: CollectionSheetItem): boolean {
    const live = item.live;
    if (!live?.todayAttemptId) return false;
    return live.todayAttemptType === 'NO_PAYMENT' || live.todayAttemptType === 'NOT_FOUND';
  }

  /** True si el monto ingresado dejaría la cuota parcial (saldo > 0 después del cobro). */
  isPartialPayment(): boolean {
    if (!this.dialogItem || !this.paymentAmount) return false;
    return this.paymentAmount < this.availableBalance(this.dialogItem);
  }

  // ── Panel cronológico (management log) ──────────────────────────────────────

  /**
   * Abre/cierra el panel del log para una cuota. Si se abre y no hay cache
   * previo, dispara la carga. Solo se mantiene abierto un panel a la vez para
   * no sobrecargar la UI en móvil.
   */
  toggleLog(item: CollectionSheetItem): void {
    if (this.expandedLogItemId === item.installmentId) {
      this.expandedLogItemId = null;
      return;
    }
    this.expandedLogItemId = item.installmentId;
    if (!this.managementLogs[item.installmentId]) {
      this.loadLog(item.installmentId);
    }
  }

  isLogExpanded(item: CollectionSheetItem): boolean {
    return this.expandedLogItemId === item.installmentId;
  }

  eventTypeLabel(type: ManagementEventType): string {
    return MANAGEMENT_EVENT_LABELS[type];
  }

  /**
   * True si el item en `index` es la primera cuota de su cliente (la anterior
   * es de otro cliente o no existe). Usado para insertar el header de
   * agrupación entre cards. Asume orden por cliente desde backend.
   */
  isFirstOfCustomer(items: CollectionSheetItem[], index: number): boolean {
    if (index === 0) return true;
    const current = items[index];
    const prev = items[index - 1];
    if (!current?.customerName || !prev?.customerName) return true;
    return prev.customerName !== current.customerName;
  }

  /** Cantidad de cuotas del cliente dado dentro de la planilla actual. */
  customerCuotasCount(customerName: string): number {
    return this.items.filter((i) => i.customerName === customerName).length;
  }

  /**
   * Selecciona una cuota para mostrar su detalle en el panel lateral.
   * @param item Cuota elegida en la tabla principal.
   */
  selectItem(item: CollectionSheetItem): void {
    this.selectedItem = item;
    this.sidePanelOpen = true;
  }

  /**
   * Abre el panel lateral de registro usando la cuota ya seleccionada.
   */
  openSidePanel(): void {
    this.sidePanelOpen = true;
  }

  /**
   * Cierra el panel lateral sin perder la cuota seleccionada.
   */
  closeSidePanel(): void {
    this.sidePanelOpen = false;
  }

  /**
   * Estado de mora derivado: una cuota está "con mora" si su vencimiento es
   * anterior a la fecha de la planilla y no está saldada/parcial. Se deriva de
   * la fecha (no del flag installment_status, que puede quedar atrasado si el
   * cron no corrió).
   */
  isOverdue(item: CollectionSheetItem): boolean {
    const status = item.live?.installmentStatus ?? item.installmentStatus;
    if (status === 'PAID' || status === 'PARTIAL') return false;
    const ref = this.sheet?.sheetDate ?? this.todayIso;
    return item.dueDate < ref;
  }

  /** True si la cuota tiene una pre-carga viva pendiente de aprobación. */
  hasPendingPaymentLive(item: CollectionSheetItem): boolean {
    return item.live?.hasPendingPayment ?? item.hasPendingPayment;
  }

  /** Items visibles según la tab activa. */
  get filteredItems(): CollectionSheetItem[] {
    switch (this.activeTab) {
      case 'OVERDUE':
        return this.items.filter((i) => this.isOverdue(i));
      case 'PENDING_PAYMENT':
        return this.items.filter((i) => this.hasPendingPaymentLive(i));
      default:
        return this.items;
    }
  }

  /** Cambia la tab activa del listado. */
  setTab(tab: 'ALL' | 'OVERDUE' | 'PENDING_PAYMENT'): void {
    this.activeTab = tab;
  }

  /**
   * Devuelve cuántas cuotas están "con mora" (derivado por fecha) en la planilla.
   */
  overdueCount(): number {
    return this.items.filter((item) => this.isOverdue(item)).length;
  }

  /**
   * Cuenta cuántas cuotas ya tienen una pre-carga pendiente de aprobación.
   * @returns Cantidad de cuotas con cobro pendiente.
   */
  pendingPaymentCount(): number {
    return this.items.filter((item) => this.hasPendingPaymentLive(item)).length;
  }

  /**
   * Devuelve la cuota en formato "X de N" usando el texto de referencia.
   * @param item Cuota seleccionada dentro de la planilla.
   * @returns Texto de progreso de cuota para el panel lateral.
   */
  installmentProgress(item: CollectionSheetItem): string {
    const ref = item.collectionReference ?? '';
    const match = ref.match(/cuota\s+(\d+)\s+de\s+(\d+)/i);
    if (match) {
      return `${match[1]} de ${match[2]}`;
    }
    return `${item.installmentNumber}`;
  }

  /** Severity para el tag del evento en el log. */
  eventSeverity(type: ManagementEventType): 'success' | 'warning' | 'secondary' {
    const map: Record<ManagementEventType, 'success' | 'warning' | 'secondary'> = {
      PAYMENT: 'success',
      NO_PAYMENT: 'warning',
      NOT_FOUND: 'secondary',
    };
    return map[type];
  }

  private loadLog(installmentId: string): void {
    this.loadingLogItemId = installmentId;
    this.installmentsService.getManagementLog(installmentId).subscribe({
      next: (log) => {
        this.managementLogs[installmentId] = log;
        this.loadingLogItemId = null;
      },
      error: () => {
        this.loadingLogItemId = null;
        this.managementLogs[installmentId] = [];
        this.msg.add({
          severity: 'warn',
          summary: 'No se pudo cargar',
          detail: 'No pudimos cargar el historial de gestiones de esta cuota.',
        });
      },
    });
  }

  // ── Diálogo de cobro ─────────────────────────────────────────────────────────

  openPaymentDialog(item: CollectionSheetItem): void {
    if (!this.canRegisterPayment(item)) return;
    this.dialogItem = item;
    this.paymentAmount = this.availableBalance(item);
    this.paymentMethod = 'CASH';
    this.transferReference = '';
    this.paymentNotes = '';
    this.paymentNextVisitDate = '';
    this.showPaymentDialog = true;
  }

  /** Limpia next_visit_date si el monto cubre el saldo completo (validación UX). */
  onPaymentAmountChange(): void {
    if (!this.isPartialPayment()) {
      this.paymentNextVisitDate = '';
    }
  }

  confirmPayment(): void {
    if (this.processingPayment) return;
    if (!this.dialogItem || !this.paymentAmount || this.paymentAmount <= 0)
      return;

    const balance = this.availableBalance(this.dialogItem);
    if (this.paymentAmount > balance) {
      this.msg.add({
        severity: 'warn',
        summary: 'Monto inválido',
        detail: `El monto no puede superar el saldo disponible ($${balance.toFixed(2)})`,
      });
      return;
    }

    const isPartial = this.paymentAmount < balance;
    const partialDateIso = isPartial ? this.paymentNextVisitDate : '';
    if (isPartial && !partialDateIso) {
      this.msg.add({
        severity: 'warn',
        summary: 'Fecha requerida',
        detail: 'Indicá la fecha de próxima visita para el cobro parcial.',
      });
      return;
    }
    if (isPartial && partialDateIso < this.todayIso) {
      this.msg.add({
        severity: 'warn',
        summary: 'Fecha inválida',
        detail: 'La próxima visita no puede ser una fecha pasada.',
      });
      return;
    }

    this.processingPayment = true;
    const payload: PaymentCreatePayload = {
      installmentId: this.dialogItem.installmentId,
      amountReceived: this.paymentAmount,
      paymentMethod: this.paymentMethod,
    };
    if (this.paymentMethod === 'TRANSFER' && this.transferReference) {
      payload.transferReference = this.transferReference;
    }
    if (this.paymentNotes) payload.notes = this.paymentNotes;
    if (isPartial) payload.nextVisitDate = partialDateIso;

    const itemId = this.dialogItem.installmentId;
    const itemNumber = this.dialogItem.installmentNumber;

    this.paymentsService.create(payload).subscribe({
      next: (result) => {
        this.processingPayment = false;
        this.showPaymentDialog = false;
        const successMsg = result.warning
          ? { severity: 'warn' as const, summary: 'Cobro registrado con advertencia', detail: result.warning }
          : isPartial
            ? { severity: 'success' as const, summary: 'Cobro parcial registrado', detail: `Pre-carga registrada. Próxima visita: ${this.formatDate(partialDateIso)}.` }
            : { severity: 'success' as const, summary: 'Cobro registrado', detail: `Pre-carga registrada para la cuota ${itemNumber}. Pendiente de aprobación.` };
        this.silentReload(itemId, successMsg);
      },
      error: (err: AppError) => {
        this.processingPayment = false;
        const severity = err.status === 409 || err.status === 422 ? 'warn' : 'error';
        this.msg.add({
          severity,
          summary:
            err.status === 422
              ? 'Datos inválidos'
              : err.status === 409
                ? 'Advertencia'
                : 'Error',
          detail: err.message ?? 'No se pudo registrar el cobro.',
        });
      },
    });
  }

  // ── Diálogo de intento (NO_PAYMENT / NOT_FOUND) ──────────────────────────────

  openAttemptDialog(item: CollectionSheetItem, type: CollectionAttemptType): void {
    if (!this.canRegisterAttempt(item)) return;
    this.attemptItem = item;
    this.attemptType = type;
    this.attemptReason = '';
    this.attemptNextVisitDate = '';
    this.attemptNotes = '';
    this.showAttemptDialog = true;
  }

  attemptTitle(): string {
    return this.attemptType === 'NO_PAYMENT' ? 'Cliente no pagó' : 'Cliente no encontrado';
  }

  confirmAttempt(): void {
    if (this.processingAttempt) return;
    if (!this.attemptItem) return;

    const attemptDateIso =
      this.attemptType === 'NO_PAYMENT' ? this.attemptNextVisitDate : '';

    if (this.attemptType === 'NO_PAYMENT') {
      if (!this.attemptReason.trim()) {
        this.msg.add({
          severity: 'warn',
          summary: 'Motivo requerido',
          detail: 'Ingresá el motivo por el que el cliente no pagó.',
        });
        return;
      }
      if (!attemptDateIso) {
        this.msg.add({
          severity: 'warn',
          summary: 'Fecha requerida',
          detail: 'Indicá la fecha de próxima visita.',
        });
        return;
      }
      if (attemptDateIso < this.todayIso) {
        this.msg.add({
          severity: 'warn',
          summary: 'Fecha inválida',
          detail: 'La próxima visita no puede ser una fecha pasada.',
        });
        return;
      }
    }

    this.processingAttempt = true;
    const payload: CollectionAttemptCreatePayload = {
      installmentId: this.attemptItem.installmentId,
      attemptType: this.attemptType,
    };
    if (this.attemptType === 'NO_PAYMENT') {
      payload.reason = this.attemptReason.trim();
      payload.nextVisitDate = attemptDateIso;
    }
    if (this.attemptNotes) payload.notes = this.attemptNotes;

    const itemId = this.attemptItem.installmentId;
    const isNoPayment = this.attemptType === 'NO_PAYMENT';
    const nextVisitForToast = attemptDateIso;

    this.attemptsService.create(payload).subscribe({
      next: () => {
        this.processingAttempt = false;
        this.showAttemptDialog = false;
        const successMsg = isNoPayment
          ? { severity: 'success' as const, summary: 'Intento registrado', detail: `Próxima visita: ${this.formatDate(nextVisitForToast)}.` }
          : { severity: 'success' as const, summary: 'Intento registrado', detail: 'Cliente no encontrado.' };
        this.silentReload(itemId, successMsg);
      },
      error: (err: AppError) => {
        this.processingAttempt = false;
        const severity = err.status === 409 || err.status === 422 ? 'warn' : 'error';
        this.msg.add({
          severity,
          summary:
            err.status === 403
              ? 'Sin acceso'
              : err.status === 422
                ? 'Datos inválidos'
                : 'Error',
          detail: err.message ?? 'No se pudo registrar el intento.',
        });
      },
    });
  }

  // ── Anulación del intento del día (supersede) ────────────────────────────────

  openVoidDialog(item: CollectionSheetItem): void {
    if (!this.canVoidTodayAttempt(item)) return;
    this.voidItem = item;
    this.showVoidDialog = true;
  }

  confirmVoid(): void {
    if (this.processingVoid) return;
    const item = this.voidItem;
    if (!item) return;
    const antecedentId = item.live?.todayAttemptId;
    if (!antecedentId) return;
    this.processingVoid = true;
    this.attemptsService.void(antecedentId).subscribe({
      next: () => {
        this.processingVoid = false;
        this.showVoidDialog = false;
        this.silentReload(item.installmentId, {
          severity: 'success',
          summary: 'Gestión anulada',
          detail: 'Podés volver a registrar la gestión de la cuota.',
        });
      },
      error: (err: AppError) => {
        this.processingVoid = false;
        const severity = err.status === 403 || err.status === 409 ? 'warn' : 'error';
        this.msg.add({
          severity,
          summary:
            err.status === 403
              ? 'No autorizado'
              : err.status === 409
                ? 'No se pudo anular'
                : 'Error',
          detail: err.message ?? 'No se pudo anular la gestión.',
        });
      },
    });
  }

  // ── Refresh silencioso preservando scroll/estado ─────────────────────────────

  /**
   * Refresca la planilla sin spinner global. Marca la cuota como en procesamiento
   * para mostrar spinner local. Si el item desaparece tras el refresh (porque se
   * reprogramó a una fecha futura), muestra un toast con un mensaje específico
   * para evitar que el cobrador piense que falló.
   */
  private silentReload(
    expectedItemId: string,
    onSuccessToast: { severity: 'success' | 'warn'; summary: string; detail: string },
  ): void {
    this.processingItemId = expectedItemId;
    // Invalida el log cacheado: si el panel queda abierto, se recargará al verlo.
    delete this.managementLogs[expectedItemId];
    this.collectionsService.getById(this.sheetId).subscribe({
      next: (data) => {
        const newItems = [...data.items].sort((a, b) => a.orderNumber - b.orderNumber);
        const stillPresent = newItems.some((i) => i.installmentId === expectedItemId);
        this.sheet = data;
        this.items = newItems;
        // Re-apuntar selectedItem al objeto fresco: el panel lateral lo lee, y si
        // quedara con la referencia vieja mostraría estado stale (botón anular
        // pegado, gestión que ya se anuló, etc.). Si la cuota desapareció del
        // listado (reprogramada), cerramos el panel.
        if (this.selectedItem) {
          const refreshed = newItems.find(
            (i) => i.installmentId === this.selectedItem!.installmentId,
          );
          this.selectedItem = refreshed ?? null;
          if (!this.selectedItem) this.sidePanelOpen = false;
        }
        this.processingItemId = null;
        if (this.expandedLogItemId === expectedItemId && stillPresent) {
          this.loadLog(expectedItemId);
        }

        if (!stillPresent) {
          this.msg.add({
            severity: 'success',
            summary: 'Gestión registrada',
            detail: 'La cuota fue reprogramada para una próxima visita y ya no figura en esta planilla.',
            life: 5000,
          });
        } else {
          this.msg.add({ ...onSuccessToast, life: 4000 });
        }
      },
      error: () => {
        this.processingItemId = null;
        this.msg.add({
          severity: 'warn',
          summary: 'Gestión registrada',
          detail: 'No pudimos refrescar la planilla. Tirá del listado o recargá la página.',
          life: 5000,
        });
      },
    });
  }

  private formatDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  // ── Carga inicial ────────────────────────────────────────────────────────────

  private load(): void {
    this.loading = true;
    this.collectionsService.getById(this.sheetId).subscribe({
      next: (data) => {
        this.sheet = data;
        this.items = [...data.items].sort((a, b) => a.orderNumber - b.orderNumber);
        this.selectedItem = this.items[0] ?? null;
        this.header.set([
          { label: 'Mi Ruta', route: '/collector/route' },
          {
            label: `Planilla ${new Date(data.sheetDate).toLocaleDateString('es-AR')}`,
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
