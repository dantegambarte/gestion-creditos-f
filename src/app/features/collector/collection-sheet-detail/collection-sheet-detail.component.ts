import { DatePipe } from '@angular/common';
import { FfBackTopFabComponent } from './../../../shared/components/back-top-fab/ff-back-top-fab.component';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DedupMessageService } from '../../../core/services/dedup-message.service';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { AppError } from '../../../core/models/app-error';
import { DateService } from '../../../core/services/date.service';
import { HeaderService } from '../../../core/services/header.service';
import { ErrorStateComponent } from '../../../shared/states/error-state/error-state.component';
import { InstallmentStatus } from '../../seller/models/installment.model';
import { InstallmentsService } from '../../seller/operations/installments.service';
import { CollectionsService } from '../collections.service';
import {
  ANTECEDENT_TYPE_LABELS,
  AntecedentType,
  COLLECTION_FILTER_LABELS,
  CollectionSheetDetail,
  CollectionSheetItem,
} from '../models/collection.model';
import { CollectionAttemptType } from '../models/collection-attempt.model';
import { ManagementLogEntry } from '../models/management-log.model';
import { AppRoutes } from '../../../shared/models/enums/routes.enum';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';
import { ActiveTabScrollerDirective } from '../../../shared/directives/active-tab-scroller.directive';
import { AttemptDialogComponent } from './attempt-dialog/attempt-dialog.component';
import { CollectionSheetPaymentPanelComponent } from './payment-panel/collection-sheet-payment-panel.component';
import { PaymentDialogComponent } from './payment-dialog/payment-dialog.component';
import { CollectionDialogSuccess } from './sheet-dialog.model';
import { VoidDialogComponent } from './void-dialog/void-dialog.component';

@Component({
  selector: 'app-collection-sheet-detail',
  standalone: true,
  imports: [
    FfBackTopFabComponent,
    CurrencyArsPipe,
    DatePipe,
    FormsModule,
    ButtonModule,
    InputTextModule,
    BadgeModule,
    ToastModule,
    SkeletonModule,
    ErrorStateComponent,
    PaymentDialogComponent,
    CollectionSheetPaymentPanelComponent,
    AttemptDialogComponent,
    VoidDialogComponent,
    BackButtonComponent,
    ActiveTabScrollerDirective,
  ],
  providers: [{ provide: MessageService, useClass: DedupMessageService }],
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
  private readonly dateSvc = inject(DateService);

  sheet: CollectionSheetDetail | null = null;
  items: CollectionSheetItem[] = [];
  selectedItem: CollectionSheetItem | null = null;
  sidePanelOpen = false;
  isMobileLayout = this.detectMobileLayout();
  private selectedItemScrollSnapshot: {
    container: HTMLElement | Window;
    sourceElement: HTMLElement | null;
    top: number;
  } | null = null;
  loading = true;
  error: AppError | null = null;

  /** Tab activa del listado: todas, con mora, sin mora, o con pre-carga pendiente. */
  activeTab: 'ALL' | 'OVERDUE' | 'NO_OVERDUE' | 'PENDING_PAYMENT' = 'ALL';

  /** Texto ingresado para buscar dentro de las cuotas visibles. */
  searchTerm = '';

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

  get todayIso(): string {
    return this.dateSvc.toLocalIso(new Date());
  }

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

  /** Actualiza el modo responsive usado para ubicar el panel de cobro. */
  @HostListener('window:resize')
  onWindowResize(): void {
    this.isMobileLayout = this.detectMobileLayout();
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
    return Math.max(
      0,
      this.displayAmountDue(item) - this.displayAmountPaid(item),
    );
  }

  /** True si una acción está en curso sobre esta cuota (refresh silencioso). */
  isItemProcessing(item: CollectionSheetItem): boolean {
    return this.processingItemId === item.installmentId;
  }

  /**
   * True si la planilla activa permite gestionar esta cuota. Usa el snapshot como
   * fallback porque algunas respuestas ACTIVE llegan sin capa `live`.
   */
  isOperable(item: CollectionSheetItem): boolean {
    return this.sheet?.status === 'ACTIVE' && item.installmentStatus !== 'PAID';
  }

  /**
   * Reglas para "Cobrar":
   *  - planilla operable, cuota no saldada, no en procesamiento, sin
   *    pre-carga pendiente.
   *  - Mantenido habilitado incluso tras un intento del día: si el cliente
   *    aparece con plata después de marcar "no pagó/no encontrado", el cobrador
   *    debe poder registrar el cobro.
   */
  canRegisterPayment(item: CollectionSheetItem): boolean {
    if (!this.isOperable(item)) return false;
    if (item.managementStatus === 'PAID') return false;
    if (this.isItemProcessing(item)) return false;
    if (this.hasPendingPaymentLive(item)) return false;
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
    return (
      live.todayAttemptType === 'NO_PAYMENT' ||
      live.todayAttemptType === 'NOT_FOUND'
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

  /** Selecciona una cuota y guarda el scroll real para volver ahí al cerrar el panel. */
  selectItem(item: CollectionSheetItem, event?: Event): void {
    this.selectedItemScrollSnapshot = this.captureScrollSnapshot(
      event?.currentTarget ?? undefined,
    );
    this.selectedItem = item;
    this.sidePanelOpen = true;
    this.scrollSidePanelIntoView();
  }

  /** Abre el panel de cobro y desplaza la vista hasta el panel renderizado. */
  openSidePanel(): void {
    this.sidePanelOpen = true;
    this.scrollSidePanelIntoView();
  }

  /** Espera el render del panel hijo y lo desplaza al inicio visible de la pantalla. */
  private scrollSidePanelIntoView(): void {
    setTimeout(() => {
      this.findPaymentPanelElement()?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
  }

  closeSidePanel(): void {
    this.sidePanelOpen = false;
    this.scrollSelectedItemIntoView();
  }

  /** Al cerrar el panel, vuelve a la fila/card seleccionada para no dejar al usuario al final de la lista. */
  private scrollSelectedItemIntoView(): void {
    setTimeout(() => {
      if (this.selectedItemScrollSnapshot) {
        this.restoreScrollSnapshot(this.selectedItemScrollSnapshot);
        return;
      }

      const installmentId = this.selectedItem?.installmentId;
      if (!installmentId) return;
      this.findVisibleInstallmentElement(installmentId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 50);
  }

  /** Busca la fila/card visible porque desktop y mobile comparten el mismo installmentId. */
  private findVisibleInstallmentElement(installmentId: string): Element | null {
    const nodes = Array.from(
      document.querySelectorAll(`[data-installment-id="${installmentId}"]`),
    );
    return nodes.find((node) => node.getClientRects().length > 0) ?? null;
  }

  /** Captura el scroll del contenedor real; en mobile no siempre scrollea window. */
  private captureScrollSnapshot(target: EventTarget | undefined): {
    container: HTMLElement | Window;
    sourceElement: HTMLElement | null;
    top: number;
  } {
    const element = target instanceof HTMLElement ? target : null;
    const container = element ? this.findScrollContainer(element) : window;
    return {
      container,
      sourceElement: element,
      top: container instanceof Window ? window.scrollY : container.scrollTop,
    };
  }

  /** Restaura el scroll guardado del contenedor que originó la apertura del panel. */
  private restoreScrollSnapshot(snapshot: {
    container: HTMLElement | Window;
    sourceElement: HTMLElement | null;
    top: number;
  }): void {
    if (snapshot.container instanceof Window) {
      snapshot.container.scrollTo({ top: snapshot.top, behavior: 'smooth' });
      return;
    }
    snapshot.container.scrollTo({ top: snapshot.top, behavior: 'smooth' });
  }

  /** Devuelve el panel activo según el layout, evitando seleccionar nodos ocultos. */
  private findPaymentPanelElement(): Element | null {
    if (this.isMobileLayout && this.selectedItem) {
      return document.querySelector(
        `[data-cy="sheet-payment-panel-inline"][data-installment-id="${this.selectedItem.installmentId}"] .sheet-side`,
      );
    }
    return document.querySelector('[data-cy="sheet-payment-panel-desktop"] .sheet-side');
  }

  /** Detecta si la UI debe usar el panel inline mobile. */
  private detectMobileLayout(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767.98px)').matches;
  }

  /** Encuentra el ancestro que realmente scrollea, evitando asumir que siempre es window. */
  private findScrollContainer(element: HTMLElement): HTMLElement | Window {
    let current = element.parentElement;
    while (current) {
      const style = window.getComputedStyle(current);
      const canScroll = /(auto|scroll)/.test(style.overflowY);
      if (canScroll && current.scrollHeight > current.clientHeight) {
        return current;
      }
      current = current.parentElement;
    }
    return window;
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
    const items = this.itemsByActiveTab();
    const term = this.normalizeSearch(this.searchTerm);
    if (!term) return items;
    return items.filter((item) => this.itemMatchesSearch(item, term));
  }

  /** Limpia la búsqueda actual sin cambiar la tab activa. */
  clearSearch(): void {
    this.searchTerm = '';
  }

  /** Items visibles antes de aplicar texto de búsqueda. */
  private itemsByActiveTab(): CollectionSheetItem[] {
    switch (this.activeTab) {
      case 'OVERDUE':
        return this.items.filter((i) => this.isOverdue(i));
      case 'NO_OVERDUE':
        return this.items.filter((i) => !this.isOverdue(i));
      case 'PENDING_PAYMENT':
        return this.items.filter((i) => this.hasPendingPaymentLive(i));
      default:
        return this.items;
    }
  }

  /** Normaliza texto para búsquedas tolerantes a mayúsculas y acentos. */
  private normalizeSearch(value: string | null | undefined): string {
    return (value ?? '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /** Evalúa si una cuota contiene el término buscado en sus datos principales. */
  private itemMatchesSearch(item: CollectionSheetItem, term: string): boolean {
    const searchable = [
      item.orderNumber,
      item.customerName,
      item.customerDni,
      item.customerPhone,
      item.customerAddress,
      item.collectionReference,
      item.installmentNumber,
      item.dueDate,
      this.installmentLabel(item.installmentStatus),
      this.availableBalance(item),
    ]
      .map((value) => this.normalizeSearch(String(value ?? '')))
      .join(' ');
    return searchable.includes(term);
  }

  /** Cambia la tab activa del listado. */
  setTab(tab: 'ALL' | 'OVERDUE' | 'NO_OVERDUE' | 'PENDING_PAYMENT'): void {
    this.activeTab = tab;
    const firstVisible = this.filteredItems[0] ?? null;
    const selectedStillVisible = this.filteredItems.some(
      (item) => item.installmentId === this.selectedItem?.installmentId,
    );
    if (!selectedStillVisible) {
      this.selectedItem = firstVisible;
      this.sidePanelOpen = false;
    }
  }

  /**
   * Devuelve cuántas cuotas están "con mora" (derivado por fecha) en la planilla.
   */
  overdueCount(): number {
    return this.items.filter((item) => this.isOverdue(item)).length;
  }

  /** Devuelve cuántas cuotas no tienen mora en la planilla. */
  noOverdueCount(): number {
    return this.items.filter((item) => !this.isOverdue(item)).length;
  }

  /**
   * Cuenta cuántas cuotas tienen una pre-carga pendiente de aprobación.
   */
  pendingPaymentCount(): number {
    return this.items.filter((item) => this.hasPendingPaymentLive(item)).length;
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
