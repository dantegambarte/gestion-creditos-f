import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { jsPDF } from 'jspdf';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, map, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { FormatService } from '../../../core/services/format.service';
import { HeaderService } from '../../../core/services/header.service';
import { ErrorStateComponent } from '../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/states/loading-state/loading-state.component';
import { CollectionsService } from '../../collector/collections.service';
import {
  COLLECTION_FILTER_LABELS,
  CollectionAlerts,
  CollectionFilter,
  CollectionGenerateResult,
  CollectionSheet,
  CollectionSheetDetail,
  CollectionSheetItem,
  SHEET_STATUS_LABELS,
} from '../../collector/models/collection.model';
import {
  GeneratedPlanillaResult,
  PlanillaEntry,
} from '../models/interface/sheet';
import { User } from '../users/user.model';
import { UsersService } from '../users/users.service';

type DetailTab = 'ALL' | 'PENDING' | 'OVERDUE' | 'PARTIAL' | 'PAID';

@Component({
  selector: 'app-admin-collections',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    DatePipe,
    FormsModule,
    ButtonModule,
    CardModule,
    DialogModule,
    DropdownModule,
    InputSwitchModule,
    SkeletonModule,
    TableModule,
    TagModule,
    ToastModule,
    TooltipModule,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  providers: [MessageService],
  templateUrl: './admin-collections.component.html',
})
export class AdminCollectionsComponent implements OnInit, OnDestroy {
  private readonly collectionsService = inject(CollectionsService);
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);
  private readonly header = inject(HeaderService);
  private readonly msg = inject(MessageService);
  readonly format = inject(FormatService);
  private destroy$ = new Subject<void>();

  // List
  sheets: CollectionSheet[] = [];
  collectors: User[] = [];
  loading = true;
  error: AppError | null = null;
  filterCollectorId: string | null = null;
  filterDate = '';
  filterIncludeRegenerated = false;

  // Alerts dialog (mostrado tras generar una planilla)
  showAlertsDialog = false;
  lastAlerts: CollectionAlerts | null = null;
  lastGeneratedSheetId: string | null = null;
  alertsOverdueExpanded = true;
  alertsUnassignedExpanded = false;

  readonly SHEET_STATUS_LABELS = SHEET_STATUS_LABELS;

  // Detail panel
  selectedSheetMeta: CollectionSheet | null = null;
  selectedSheet: CollectionSheetDetail | null = null;
  loadingDetail = false;
  activeTab: DetailTab = 'ALL';
  leftPanelCollapsed = false;

  // Generation dialog
  showGenerateDialog = false;
  selectedCollectorId: string | null = null;
  selectedDate: string = new Date().toISOString().split('T')[0];
  selectedFilter: CollectionFilter = 'OVERDUE';
  filterOptions: { label: string; value: CollectionFilter }[] = [
    { label: 'Solo vencidas', value: 'OVERDUE' },
    { label: 'Del día', value: 'TODAY' },
    { label: 'Vencidas + hoy', value: 'TODAY_AND_OVERDUE' },
    { label: 'Todas pendientes', value: 'ALL_PENDING' },
  ];
  generating = false;
  generatingAll = false;

  /**
   * Opciones de cobrador para los dropdowns de filtro y generación.
   */
  get collectorOptions(): { label: string; value: string }[] {
    return this.collectors.map((c) => ({ label: c.fullName, value: c.id }));
  }

  /**
   * Items del detalle filtrados por tab activa.
   */
  get filteredItems(): CollectionSheetItem[] {
    if (!this.selectedSheet) return [];
    if (this.activeTab === 'ALL') return this.selectedSheet.items;
    return this.selectedSheet.items.filter(
      (i) => i.installmentStatus === this.activeTab,
    );
  }

  /**
   * True si la planilla seleccionada está en estado REGENERATED.
   * En ese caso no se permiten acciones operativas (solo lectura/auditoría).
   */
  get isSelectedSheetReadonly(): boolean {
    return this.selectedSheetMeta?.status === 'REGENERATED';
  }

  /**
   * Cuenta los items por estado para mostrar en las tabs.
   * @param status Estado a contar
   * @returns Cantidad de items con ese estado
   */
  countByStatus(status: string): number {
    if (!this.selectedSheet) return 0;
    return this.selectedSheet.items.filter(
      (i) => i.installmentStatus === status,
    ).length;
  }

  ngOnInit(): void {
    this.header.set([{ label: 'Planillas de cobro' }]);
    this.usersService
      .listCollectors()
      .pipe(takeUntil(this.destroy$))
      .subscribe((c) => (this.collectors = c));
    this.load();
  }

  ngOnDestroy(): void {
    this.header.reset();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Devuelve la etiqueta del filtro de cobro.
   * @param f Filtro aplicado
   */
  filterLabel(f: CollectionFilter): string {
    return COLLECTION_FILTER_LABELS[f];
  }

  /**
   * Recarga la lista con los filtros actuales.
   */
  applyFilters(): void {
    this.load();
  }

  /**
   * Limpia los filtros y recarga la lista completa.
   */
  clearFilters(): void {
    this.filterCollectorId = null;
    this.filterDate = '';
    this.filterIncludeRegenerated = false;
    this.load();
  }

  /**
   * Cierra el diálogo de alertas y opcionalmente foco la planilla generada.
   */
  closeAlertsDialog(): void {
    this.showAlertsDialog = false;
  }

  /**
   * True si la última generación devolvió al menos un tipo de alerta.
   */
  get hasAlerts(): boolean {
    if (!this.lastAlerts) return false;
    return (
      this.lastAlerts.overdueNextVisits.length > 0 ||
      this.lastAlerts.unassignedCustomers.length > 0
    );
  }

  /**
   * Selecciona una planilla y carga su detalle en el panel derecho.
   * @param sheet Planilla seleccionada de la lista
   */
  selectSheet(sheet: CollectionSheet): void {
    this.selectedSheetMeta = sheet;
    this.selectedSheet = null;
    this.loadingDetail = true;
    this.activeTab = 'ALL';
    this.collectionsService
      .getById(sheet.id)
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
   * Abre el diálogo de generación de planilla.
   */
  openGenerateDialog(): void {
    this.showGenerateDialog = true;
  }

  /**
   * Genera una planilla para el cobrador seleccionado en el diálogo.
   * Tras éxito, si la respuesta trae alertas operativas, muestra el diálogo
   * de alertas con `overdueNextVisits` priorizado (más crítico).
   */
  generatePlanilla(): void {
    if (!this.selectedCollectorId || this.generating || this.generatingAll)
      return;
    this.generating = true;
    this.collectionsService
      .generate({
        collectorId: this.selectedCollectorId,
        date: this.selectedDate,
        filter: this.selectedFilter,
      })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.generating = false)),
      )
      .subscribe({
        next: (result: CollectionGenerateResult) => {
          this.showGenerateDialog = false;
          this.applyGenerationResult(result);
          this.load();
        },
        error: (err: AppError) => {
          this.msg.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary: err.status === 409 ? 'Sin cuotas' : 'Error',
            detail: err.message ?? 'No se pudo generar la planilla.',
            life: 5000,
          });
        },
      });
  }

  /**
   * Aplica el resultado de una generación al panel derecho y dispara el diálogo
   * de alertas cuando corresponda (overdue priorizado y expandido por defecto).
   */
  private applyGenerationResult(result: CollectionGenerateResult): void {
    this.selectedSheet = result.sheet;
    this.selectedSheetMeta = {
      id: result.sheet.id,
      sheetDate: result.sheet.sheetDate,
      filterUsed: result.sheet.filterUsed,
      status: result.sheet.status,
      createdAt: result.sheet.createdAt,
      collectorName: result.sheet.collectorName,
      totalItems: result.sheet.totalItems,
    };
    this.activeTab = 'ALL';
    this.leftPanelCollapsed = false;

    this.lastAlerts = result.alerts;
    this.lastGeneratedSheetId = result.sheet.id;
    const hasOverdue = result.alerts.overdueNextVisits.length > 0;
    const hasUnassigned = result.alerts.unassignedCustomers.length > 0;

    if (hasOverdue || hasUnassigned) {
      this.alertsOverdueExpanded = hasOverdue;
      this.alertsUnassignedExpanded = !hasOverdue && hasUnassigned;
      this.showAlertsDialog = true;
    } else {
      this.msg.add({
        severity: 'success',
        summary: 'Planilla generada',
        detail: 'Planilla generada sin alertas operativas.',
        life: 4000,
      });
    }
  }

  /**
   * Genera planillas para todos los cobradores en paralelo.
   */
  generateForAll(): void {
    if (this.generatingAll || this.generating) return;
    this.generatingAll = true;
    this.usersService
      .listCollectors()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (collectors) => {
          if (collectors.length === 0) {
            this.generatingAll = false;
            return;
          }
          const requests = collectors.map((c) =>
            this.collectionsService
              .generate({
                collectorId: c.id,
                date: this.selectedDate,
                filter: this.selectedFilter,
              })
              .pipe(
                map((result) => ({
                  success: true as const,
                  collectorName: c.fullName,
                  result,
                })),
                catchError((err: AppError) =>
                  of({
                    success: false as const,
                    collectorName: c.fullName,
                    error: err,
                  }),
                ),
              ),
          );
          forkJoin(requests)
            .pipe(
              takeUntil(this.destroy$),
              finalize(() => (this.generatingAll = false)),
            )
            .subscribe((outcomes) => {
              const successOutcomes = outcomes.filter((o) => o.success);
              const failures = outcomes.filter((o) => !o.success);
              const withAlerts = successOutcomes.filter((o) =>
                o.success &&
                (o.result.alerts.overdueNextVisits.length > 0 ||
                  o.result.alerts.unassignedCustomers.length > 0),
              ).length;
              if (successOutcomes.length > 0) {
                const alertsNote = withAlerts > 0
                  ? ` ${withAlerts} con alertas operativas — abrilas para revisarlas.`
                  : '';
                this.msg.add({
                  severity: 'success',
                  summary: 'Planillas generadas',
                  detail: `${successOutcomes.length} planilla(s) generadas correctamente.${alertsNote}`,
                  life: 5000,
                });
                this.showGenerateDialog = false;
                this.load();
              }
              if (failures.length > 0) {
                const names = failures.map((f) => f.collectorName).join(', ');
                this.msg.add({
                  severity: 'warn',
                  summary: 'Sin cuotas',
                  detail: `Sin cuotas para: ${names}`,
                  life: 8000,
                });
              }
            });
        },
        error: () => (this.generatingAll = false),
      });
  }

  /**
   * Descarga el detalle de la planilla seleccionada en formato PDF.
   */
  downloadPdf(): void {
    if (!this.selectedSheet) return;
    const result = this.mapDetailToResult(this.selectedSheet);
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const startX = 14;
    let y = 20;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Planilla de Cobro', pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cobrador: ${result.collectorName}`, startX, y);
    doc.text(`Fecha: ${this.formatDate(result.fecha)}`, pageWidth - 14, y, {
      align: 'right',
    });
    y += 6;
    doc.text(`Cuotas: ${result.clientCount}`, startX, y);
    doc.text(
      `Total: ${this.formatCurrency(result.totalAmount)}`,
      pageWidth - 14,
      y,
      { align: 'right' },
    );
    y += 8;

    const colWidths = [60, 18, 15, 20, 25, 29];
    const headers = [
      'Cliente',
      'Tipo',
      'N° Cuota',
      'Estado',
      'Vencimiento',
      'Monto',
    ];
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);

    doc.setFillColor(41, 98, 255);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.rect(startX, y - 4, tableWidth, 7, 'F');
    let x = startX;
    headers.forEach((h, i) => {
      doc.text(h, x + 2, y);
      x += colWidths[i];
    });
    y += 5;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    result.entries.forEach((entry, idx) => {
      const subLines: string[] = [];
      if (entry.clientPhone) subLines.push(`Tel: ${entry.clientPhone}`);
      if (entry.clientAddress)
        subLines.push(entry.clientAddress.substring(0, 35));
      const rowHeight = 6 + subLines.length * 4;

      if (y + rowHeight > 275) {
        doc.addPage();
        y = 20;
      }
      if (idx % 2 === 0) {
        doc.setFillColor(245, 247, 250);
        doc.rect(startX, y - 4, tableWidth, rowHeight, 'F');
      }

      x = startX;
      const mainRow = [
        entry.clientName.substring(0, 32),
        entry.creditType === 'SALE' ? 'Venta' : 'Préstamo',
        String(entry.installmentNumber),
        entry.paymentStatus,
        this.formatDate(entry.dueDate),
        this.formatCurrency(entry.amount),
      ];
      mainRow.forEach((cell, i) => {
        doc.text(cell, x + 2, y);
        x += colWidths[i];
      });

      if (subLines.length > 0) {
        doc.setFontSize(6.5);
        doc.setTextColor(100, 100, 100);
        subLines.forEach((line, li) => {
          doc.text(line, startX + 2, y + 4 + li * 4);
        });
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
      }

      y += rowHeight;
    });

    const safeName = (result.collectorName ?? 'cobrador').replace(/\s+/g, '-');
    const safeDate = result.fecha ?? new Date().toISOString().split('T')[0];
    doc.save(`planilla-${safeName}-${safeDate}.pdf`);
  }

  /**
   * Navega al detalle del crédito.
   * @param creditId ID del crédito
   */
  goToCredit(creditId: string): void {
    this.router.navigate(['/admin/operations', creditId]);
  }

  /**
   * Devuelve la severidad de color según el estado de la cuota.
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
   * Devuelve la etiqueta de estado de una cuota.
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

  /**
   * Carga la lista de planillas aplicando los filtros activos.
   * Si `filterIncludeRegenerated` está activo, también lista planillas REGENERATED
   * (auditoría — solo lectura).
   */
  private load(): void {
    this.loading = true;
    this.error = null;
    const filters: {
      collectorId?: string;
      date?: string;
      includeRegenerated?: boolean;
    } = {};
    if (this.filterCollectorId) filters.collectorId = this.filterCollectorId;
    if (this.filterDate) filters.date = this.filterDate;
    if (this.filterIncludeRegenerated) filters.includeRegenerated = true;
    this.collectionsService.list(filters).subscribe({
      next: (data) => {
        this.sheets = data;
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }

  /**
   * Mapea el detalle de una planilla al formato requerido para el PDF.
   * @param detail Detalle completo de la planilla
   */
  private mapDetailToResult(
    detail: CollectionSheetDetail,
  ): GeneratedPlanillaResult {
    const entries: PlanillaEntry[] = detail.items.map((item) => ({
      clientName: item.customerName,
      clientDni: 'N/D',
      clientPhone: item.customerPhone,
      clientAddress: item.customerAddress,
      creditId: item.creditId,
      creditType: item.creditType,
      installmentNumber: item.installmentNumber,
      amount: item.amountDue,
      paidAmount: item.amountPaid,
      dueDate: item.dueDate,
      paymentStatus: this.mapInstallmentStatus(item.installmentStatus),
    }));
    return {
      collectorId: detail.collectorId,
      collectorName: detail.collectorName,
      fecha: detail.sheetDate,
      clientCount: detail.items.length,
      totalAmount: detail.items.reduce((sum, i) => sum + i.amountDue, 0),
      sheetId: detail.id,
      entries,
    };
  }

  /**
   * Mapea el estado interno al texto de la planilla PDF.
   * @param status Estado de pago
   */
  private mapInstallmentStatus(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'PENDIENTE',
      OVERDUE: 'EN_MORA',
      PARTIAL: 'PARCIAL',
      PAID: 'COBRADO',
    };
    return map[status] ?? status;
  }
}
