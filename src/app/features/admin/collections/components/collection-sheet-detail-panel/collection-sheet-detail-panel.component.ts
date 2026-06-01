import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { FormatService } from '../../../../../core/services/format.service';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { LoadingStateComponent } from '../../../../../shared/states/loading-state/loading-state.component';
import { CollectionsService } from '../../../../collector/collections.service';
import {
  COLLECTION_FILTER_LABELS,
  CollectionFilter,
  CollectionSheetDetail,
  CollectionSheetItem,
  INCLUSION_REASON_LABELS,
  InclusionReason,
} from '../../../../collector/models/collection.model';
import {
  MANAGEMENT_EVENT_LABELS,
  ManagementEventType,
  ManagementLogEntry,
} from '../../../../collector/models/management-log.model';
import { InstallmentsService } from '../../../../seller/operations/installments.service';
import { CollectionPdfService } from '../../collection-pdf.service';
import { CollectionSheet } from '../../../../collector/models/collection.model';

export type DetailTab = 'ALL' | 'PENDING' | 'OVERDUE' | 'PARTIAL' | 'PAID';

@Component({
  selector: 'app-collection-sheet-detail-panel',
  standalone: true,
  imports: [
    DatePipe,
    CurrencyArsPipe,
    ButtonModule,
    ProgressSpinnerModule,
    TableModule,
    TagModule,
    TooltipModule,
    LoadingStateComponent,
  ],
  templateUrl: './collection-sheet-detail-panel.component.html',
})
export class CollectionSheetDetailPanelComponent
  implements OnChanges, OnDestroy
{
  @Input() sheetMeta: CollectionSheet | null = null;
  /** Two-way binding para el estado colapsado del panel izquierdo. */
  @Input() collapsed = false;
  @Output() collapsedChange = new EventEmitter<boolean>();
  /** Emite cuando el usuario cierra el panel derecho. */
  @Output() closed = new EventEmitter<void>();

  /** Tab a abrir tras la primera carga — usado para navegación por URL. */
  @Input() set openTab(v: DetailTab | null) {
    this._pendingTab = v;
  }

  private readonly collectionsService = inject(CollectionsService);
  private readonly installmentsService = inject(InstallmentsService);
  private readonly pdfSvc = inject(CollectionPdfService);
  private readonly router = inject(Router);
  readonly format = inject(FormatService);
  private destroy$ = new Subject<void>();

  selectedSheet: CollectionSheetDetail | null = null;
  loadingDetail = false;
  activeTab: DetailTab = 'ALL';

  expandedLogItemId: string | null = null;
  managementLogs: Record<string, ManagementLogEntry[]> = {};
  loadingLogItemId: string | null = null;

  private _pendingTab: DetailTab | null = null;

  /**
   * True si la planilla es solo lectura (fue regenerada).
   */
  get isReadonly(): boolean {
    return this.sheetMeta?.status === 'REGENERATED';
  }

  /**
   * Items del detalle filtrados por la tab activa.
   */
  get filteredItems(): CollectionSheetItem[] {
    if (!this.selectedSheet) return [];
    if (this.activeTab === 'ALL') return this.selectedSheet.items;
    return this.selectedSheet.items.filter(
      (i) => i.installmentStatus === this.activeTab,
    );
  }

  /**
   * Recarga el detalle cuando cambia la planilla seleccionada.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sheetMeta'] && this.sheetMeta) {
      this.loadDetail();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga el breakdown completo de la planilla seleccionada.
   */
  private loadDetail(): void {
    if (!this.sheetMeta) return;
    this.selectedSheet = null;
    this.loadingDetail = true;
    this.activeTab = 'ALL';
    this.expandedLogItemId = null;
    this.collectionsService
      .getById(this.sheetMeta.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loadingDetail = false)),
      )
      .subscribe({
        next: (detail) => {
          this.selectedSheet = detail;
          if (this._pendingTab) {
            this.activeTab = this._pendingTab;
            this._pendingTab = null;
          }
        },
        error: () => {},
      });
  }

  /**
   * Recarga el detalle de la planilla actual para reflejar cambios recientes.
   */
  reloadDetail(): void {
    if (!this.sheetMeta) return;
    this.loadingDetail = true;
    this.collectionsService
      .getById(this.sheetMeta.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loadingDetail = false)),
      )
      .subscribe({
        next: (detail) => (this.selectedSheet = detail),
        error: () => {},
      });
  }

  /**
   * Descarga la planilla como PDF imprimible.
   */
  downloadPdf(): void {
    if (!this.selectedSheet) return;
    this.pdfSvc.generate(this.selectedSheet);
  }

  /**
   * Navega al detalle del crédito con contexto de retorno.
   * @param creditId ID del crédito a navegar
   */
  goToCredit(creditId: string | null | undefined): void {
    if (!creditId) return;
    this.router.navigate(['/admin/operations', creditId], {
      queryParams: {
        returnTo: 'admin-collections',
        sheetId: this.sheetMeta?.id ?? null,
        openTab: this.activeTab,
      },
    });
  }

  /**
   * Abre/cierra el panel de log de gestión para una cuota. Carga si no está en cache.
   * @param installmentId ID de la cuota
   */
  toggleLog(installmentId: string): void {
    if (this.expandedLogItemId === installmentId) {
      this.expandedLogItemId = null;
      return;
    }
    this.expandedLogItemId = installmentId;
    if (!this.managementLogs[installmentId]) {
      this.loadingLogItemId = installmentId;
      this.installmentsService
        .getManagementLog(installmentId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (log) => {
            this.managementLogs[installmentId] = log;
            this.loadingLogItemId = null;
          },
          error: () => {
            this.managementLogs[installmentId] = [];
            this.loadingLogItemId = null;
          },
        });
    }
  }

  isLogExpanded(installmentId: string): boolean {
    return this.expandedLogItemId === installmentId;
  }

  /**
   * Cuenta items por estado de cuota para mostrar en las tabs.
   * @param status Estado a contar
   */
  countByStatus(status: string): number {
    if (!this.selectedSheet) return 0;
    return this.selectedSheet.items.filter(
      (i) => i.installmentStatus === status,
    ).length;
  }

  /**
   * True si el item es la primera cuota de su cliente en la lista.
   * @param items Lista de items
   * @param index Índice del item actual
   */
  isFirstOfCustomer(items: CollectionSheetItem[], index: number): boolean {
    if (index === 0) return true;
    const current = items[index];
    const prev = items[index - 1];
    if (!current?.customerName || !prev?.customerName) return true;
    return prev.customerName !== current.customerName;
  }

  /**
   * Cantidad de cuotas del cliente en la planilla actual.
   * @param customerName Nombre del cliente
   */
  customerCuotasCount(customerName: string): number {
    if (!this.selectedSheet) return 0;
    return this.selectedSheet.items.filter(
      (i) => i.customerName === customerName,
    ).length;
  }

  /**
   * Alterna el estado colapsado del panel izquierdo.
   */
  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    this.collapsedChange.emit(this.collapsed);
  }

  eventTypeLabel(type: ManagementEventType): string {
    return MANAGEMENT_EVENT_LABELS[type];
  }

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

  /**
   * Severidad de color según el estado de la cuota.
   * @param status Estado de la cuota
   */
  installmentSeverity(
    status: string,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    const map: Record<
      string,
      'success' | 'info' | 'warning' | 'danger' | 'secondary'
    > = {
      PENDING: 'info',
      OVERDUE: 'danger',
      PAID: 'success',
      PARTIAL: 'warning',
    };
    return map[status] ?? 'secondary';
  }

  /**
   * Etiqueta legible del estado de la cuota.
   * @param status Estado de la cuota
   */
  installmentLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'Pendiente',
      OVERDUE: 'En mora',
      PAID: 'Cobrado',
      PARTIAL: 'Cob. pend.',
    };
    return map[status] ?? status;
  }

  /** Etiqueta amigable del motivo de inclusión. */
  inclusionReasonLabel(reason: InclusionReason | null | undefined): string {
    if (!reason) return '';
    return INCLUSION_REASON_LABELS[reason] ?? '';
  }

  /** Color de fondo del chip según el motivo de inclusión. */
  inclusionReasonBg(reason: InclusionReason | null | undefined): string {
    switch (reason) {
      case 'OVERDUE':
      case 'OVERDUE_UNSCHEDULED':
        return '#fee2e2';
      case 'DUE_TODAY':
        return '#dbeafe';
      case 'SCHEDULED_VISIT':
        return '#ede9fe';
      default:
        return '#f3f4f6';
    }
  }

  /** Color de texto del chip según el motivo de inclusión. */
  inclusionReasonFg(reason: InclusionReason | null | undefined): string {
    switch (reason) {
      case 'OVERDUE':
      case 'OVERDUE_UNSCHEDULED':
        return '#991b1b';
      case 'DUE_TODAY':
        return '#1e40af';
      case 'SCHEDULED_VISIT':
        return '#6d28d9';
      default:
        return '#4b5563';
    }
  }

  /**
   * Etiqueta del filtro de cobro.
   * @param f Filtro aplicado
   */
  filterLabel(f: CollectionFilter): string {
    return COLLECTION_FILTER_LABELS[f];
  }

  /**
   * Formatea una fecha ISO a dd/mm/yyyy.
   * @param iso Fecha en formato ISO
   */
  formatDate(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  }

  /**
   * Formatea un número como moneda ARS.
   * @param value Monto a formatear
   */
  formatCurrency(value: number): string {
    return this.format.currency(value);
  }
}
