import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
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
import { CollectionsService } from '../collections.service';
import {
  COLLECTION_FILTER_LABELS,
  CollectionSheetDetail,
  CollectionSheetItem,
} from '../models/collection.model';
import { CollectionAttemptType } from '../models/collection-attempt.model';
import {
  MANAGEMENT_EVENT_LABELS,
  ManagementEventType,
  ManagementLogEntry,
} from '../models/management-log.model';
import { AppRoutes } from '../../../shared/models/enums/routes.enum';
import { AttemptDialogComponent } from './dialogs/attempt-dialog.component';
import { PaymentDialogComponent } from './dialogs/payment-dialog.component';
import { CollectionDialogSuccess } from './dialogs/sheet-dialog.model';
import { VoidDialogComponent } from './dialogs/void-dialog.component';

@Component({
  selector: 'app-collection-sheet-detail',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    DatePipe,
    FormsModule,
    ButtonModule,
    TagModule,
    BadgeModule,
    ToastModule,
    ProgressSpinnerModule,
    TooltipModule,
    LoadingStateComponent,
    ErrorStateComponent,
    PaymentDialogComponent,
    AttemptDialogComponent,
    VoidDialogComponent,
  ],
  providers: [MessageService],
  templateUrl: './collection-sheet-detail.component.html',
  styleUrl: './collection-sheet-detail.component.scss',
})
export class CollectionSheetDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly collectionsService = inject(CollectionsService);
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

  /** ID de la cuota cuyo refresh silencioso está en curso (spinner local). */
  processingItemId: string | null = null;

  // ── Panel cronológico (management log) por cuota ─────────────────────────────
  expandedLogItemId: string | null = null;
  managementLogs: Record<string, ManagementLogEntry[]> = {};
  loadingLogItemId: string | null = null;

  // ── Estado de dialogs ────────────────────────────────────────────────────────
  showPaymentDialog = false;
  paymentDialogItem: CollectionSheetItem | null = null;

  showAttemptDialog = false;
  attemptDialogItem: CollectionSheetItem | null = null;
  attemptDialogType: CollectionAttemptType = 'NO_PAYMENT';

  showVoidDialog = false;
  voidDialogItem: CollectionSheetItem | null = null;

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

  /**
   * Devuelve el saldo pendiente de la cuota (monto - pagado).
   * @param item Cuota a evaluar.
   */
  availableBalance(item: CollectionSheetItem): number {
    return Math.max(0, item.amountDue - item.amountPaid);
  }

  /** True si una acción está en curso sobre esta cuota (refresh silencioso). */
  isItemProcessing(item: CollectionSheetItem): boolean {
    return this.processingItemId === item.installmentId;
  }

  /**
   * Reglas para "Cobrar":
   *  - planilla activa, cuota no pagada, no en procesamiento, sin pre-carga pendiente.
   */
  canRegisterPayment(item: CollectionSheetItem): boolean {
    if (this.sheet?.status === 'REGENERATED') return false;
    if (item.installmentStatus === 'PAID') return false;
    if (this.isItemProcessing(item)) return false;
    if (item.hasPendingPayment) return false;
    return true;
  }

  /**
   * Reglas para "No pagó" / "No encontrado":
   *  - todas las del cobro, PLUS no se permite si ya hubo una gestión del día.
   */
  canRegisterAttempt(item: CollectionSheetItem): boolean {
    if (!this.canRegisterPayment(item)) return false;
    if (this.alreadyManagedToday(item)) return false;
    return true;
  }

  /** True si esta cuota ya tiene una gestión registrada en la fecha actual. */
  alreadyManagedToday(item: CollectionSheetItem): boolean {
    return !!item.antecedentDate && item.antecedentDate === this.todayIso;
  }

  /**
   * True si el antecedente del día es un intento (no un cobro parcial) y puede anularse.
   */
  canVoidTodayAttempt(item: CollectionSheetItem): boolean {
    if (!this.alreadyManagedToday(item)) return false;
    if (!item.antecedentId) return false;
    return (
      item.antecedentType === 'NO_PAYMENT' ||
      item.antecedentType === 'NOT_FOUND'
    );
  }

  // ── Apertura de dialogs ──────────────────────────────────────────────────────

  openPaymentDialog(item: CollectionSheetItem): void {
    if (!this.canRegisterPayment(item)) return;
    this.paymentDialogItem = item;
    this.showPaymentDialog = true;
  }

  openAttemptDialog(
    item: CollectionSheetItem,
    type: CollectionAttemptType,
  ): void {
    if (!this.canRegisterAttempt(item)) return;
    this.attemptDialogItem = item;
    this.attemptDialogType = type;
    this.showAttemptDialog = true;
  }

  openVoidDialog(item: CollectionSheetItem): void {
    if (!this.canVoidTodayAttempt(item)) return;
    this.voidDialogItem = item;
    this.showVoidDialog = true;
  }

  /**
   * Punto de entrada unificado para todos los dialogs de gestión.
   * Ejecuta el refresh silencioso con el toast que el dialog calcula.
   * @param event Resultado emitido por el dialog hijo.
   */
  onDialogActionDone(event: CollectionDialogSuccess): void {
    this.silentReload(event.itemId, event.toast);
  }

  // ── Panel cronológico (management log) ──────────────────────────────────────

  /**
   * Abre/cierra el panel del log para una cuota. Si se abre y no hay cache
   * previo, dispara la carga.
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
   * True si el item en `index` es la primera cuota de su cliente.
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

  selectItem(item: CollectionSheetItem): void {
    this.selectedItem = item;
    this.sidePanelOpen = true;
  }

  openSidePanel(): void {
    this.sidePanelOpen = true;
  }

  closeSidePanel(): void {
    this.sidePanelOpen = false;
  }

  /**
   * Devuelve cuántas cuotas están vencidas en la planilla.
   */
  overdueCount(): number {
    return this.items.filter((item) => item.installmentStatus === 'OVERDUE')
      .length;
  }

  /**
   * Cuenta cuántas cuotas tienen una pre-carga pendiente de aprobación.
   */
  pendingPaymentCount(): number {
    return this.items.filter((item) => item.hasPendingPayment).length;
  }

  /**
   * Devuelve el progreso de la cuota en formato "X de N".
   * @param item Cuota seleccionada dentro de la planilla.
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
  eventSeverity(
    type: ManagementEventType,
  ): 'success' | 'warning' | 'secondary' {
    const map: Record<
      ManagementEventType,
      'success' | 'warning' | 'secondary'
    > = {
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

  /**
   * Refresca la planilla sin spinner global. Muestra spinner local en la cuota
   * procesada. Si la cuota desaparece tras el refresh (reprogramada), muestra
   * un mensaje específico para evitar confusión.
   */
  private silentReload(
    expectedItemId: string,
    onSuccessToast: {
      severity: 'success' | 'warn';
      summary: string;
      detail: string;
    },
  ): void {
    this.processingItemId = expectedItemId;
    delete this.managementLogs[expectedItemId];
    this.collectionsService.getById(this.sheetId).subscribe({
      next: (data) => {
        const newItems = [...data.items].sort(
          (a, b) => a.orderNumber - b.orderNumber,
        );
        const stillPresent = newItems.some(
          (i) => i.installmentId === expectedItemId,
        );
        this.sheet = data;
        this.items = newItems;
        this.processingItemId = null;
        if (this.expandedLogItemId === expectedItemId && stillPresent) {
          this.loadLog(expectedItemId);
        }

        if (!stillPresent) {
          this.msg.add({
            severity: 'success',
            summary: 'Gestión registrada',
            detail:
              'La cuota fue reprogramada para una próxima visita y ya no figura en esta planilla.',
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
          detail:
            'No pudimos refrescar la planilla. Tirá del listado o recargá la página.',
          life: 5000,
        });
      },
    });
  }

  private load(): void {
    this.loading = true;
    this.collectionsService.getById(this.sheetId).subscribe({
      next: (data) => {
        this.sheet = data;
        this.items = [...data.items].sort(
          (a, b) => a.orderNumber - b.orderNumber,
        );
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
