import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { jsPDF } from 'jspdf';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
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
  CollectionGenerateOutcome,
  CollectionGenerateResult,
  CollectionSheet,
  CollectionSheetDetail,
  CollectionSheetItem,
  SHEET_STATUS_LABELS,
} from '../../collector/models/collection.model';
import {
  MANAGEMENT_EVENT_LABELS,
  ManagementEventType,
  ManagementLogEntry,
} from '../../collector/models/management-log.model';
import { InstallmentsService } from '../../seller/operations/installments.service';
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
    CalendarModule,
    CardModule,
    DialogModule,
    DropdownModule,
    InputSwitchModule,
    ProgressSpinnerModule,
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
  private readonly installmentsService = inject(InstallmentsService);
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
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

  // ── Panel de log cronológico por cuota (auditoría admin) ─────────────────────
  expandedLogItemId: string | null = null;
  managementLogs: Record<string, ManagementLogEntry[]> = {};
  loadingLogItemId: string | null = null;

  // Detail panel
  selectedSheetMeta: CollectionSheet | null = null;
  selectedSheet: CollectionSheetDetail | null = null;
  loadingDetail = false;
  activeTab: DetailTab = 'ALL';
  leftPanelCollapsed = false;

  // Generation dialog
  /** Valor especial del dropdown que representa "todos los cobradores". */
  readonly ALL_COLLECTORS = 'ALL';
  showGenerateDialog = false;
  /** UUID de un cobrador específico o 'ALL' para modo batch. Default 'ALL'. */
  selectedCollectorId: string = this.ALL_COLLECTORS;
  selectedDate: string = new Date().toISOString().split('T')[0];
  readonly todayDate = new Date();
  /** Fecha mínima del input de generación: hoy. Bloquea seleccionar fechas pasadas. */
  readonly todayIsoDate: string = new Date().toISOString().split('T')[0];
  selectedFilter: CollectionFilter = 'OVERDUE';
  filterOptions: { label: string; value: CollectionFilter }[] = [
    { label: 'Solo vencidas', value: 'OVERDUE' },
    { label: 'Del día', value: 'TODAY' },
    { label: 'Vencidas + hoy', value: 'TODAY_AND_OVERDUE' },
    { label: 'Todas pendientes', value: 'ALL_PENDING' },
  ];
  generating = false;
  generatingAll = false;

  // ── Estado del modal de generación (resumen y conflictos) ─────────────────
  /** Planillas ACTIVE del día seleccionado en el modal — fuente del resumen. */
  dialogSheets: CollectionSheet[] = [];
  /** Mini-loader local mientras se trae dialogSheets para evitar mostrar datos stale. */
  loadingDialogSheets = false;
  /** Toggle del bloque batch: si true, el "Generar para todos" regenera también las existentes. */
  regenerateExisting = false;

  /**
   * Opciones de cobrador para el dropdown del filtro (sin "Todos" — el filtro
   * ya tiene su propio showClear y placeholder).
   */
  get collectorOptions(): { label: string; value: string }[] {
    return this.collectors.map((c) => ({ label: c.fullName, value: c.id }));
  }

  /**
   * Opciones del dropdown del modal de generación, con "Todos los cobradores"
   * como primer item. Es la única vía para elegir el modo batch (no hay un
   * botón separado). El conteo dinámico ayuda al admin a tomar decisión.
   */
  get generateCollectorOptions(): { label: string; value: string }[] {
    return [
      {
        label: `Todos los cobradores (${this.collectors.length})`,
        value: this.ALL_COLLECTORS,
      },
      ...this.collectors.map((c) => ({ label: c.fullName, value: c.id })),
    ];
  }

  /** True si el dropdown del modal está en modo "todos los cobradores". */
  get isBatchMode(): boolean {
    return this.selectedCollectorId === this.ALL_COLLECTORS;
  }

  /** Nombre del cobrador seleccionado en el modal (single mode), o '' en batch. */
  get selectedCollectorName(): string {
    if (this.isBatchMode) return '';
    return (
      this.collectors.find((c) => c.id === this.selectedCollectorId)
        ?.fullName ?? ''
    );
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
    this.maybeAutoOpenGenerate();
  }

  /**
   * Abre automáticamente el diálogo de generación si llegamos con
   * ?openGenerate=true (por ej. desde el botón del dashboard o la ruta
   * legada /admin/collections/new). Limpia el query param con replaceUrl
   * para que un refresh o un "atrás" no reabran el modal.
   */
  private maybeAutoOpenGenerate(): void {
    if (this.route.snapshot.queryParamMap.get('openGenerate') !== 'true')
      return;
    this.openGenerateDialog();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
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
   * Recarga el detalle de la planilla actualmente seleccionada para reflejar
   * cambios recientes (ej: reversiones de cobros realizadas desde otra vista).
   */
  reloadDetail(): void {
    if (!this.selectedSheetMeta) return;
    this.loadingDetail = true;
    this.collectionsService
      .getById(this.selectedSheetMeta.id)
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
   * Abre el diálogo de generación de planilla. Default conservador:
   *   - Cobrador: "Todos" (intent mayoritario del quick-action).
   *   - Toggle de regenerar: OFF.
   *   - Fecha: hoy (ya inicializada).
   * Dispara la carga del resumen del día.
   */
  openGenerateDialog(): void {
    this.showGenerateDialog = true;
    this.selectedCollectorId = this.ALL_COLLECTORS;
    this.regenerateExisting = false;
    this.loadDialogSheets();
  }

  /**
   * Único punto de entrada del modal: despacha al flujo correcto según el
   * modo (batch o individual). Reemplaza los dos botones que existían antes
   * y elimina la ambigüedad de "¿cuál apretar?".
   */
  submit(): void {
    if (this.submitDisabled) return;
    if (this.isBatchMode) {
      this.generateForAll();
    } else {
      this.generatePlanilla();
    }
  }

  /**
   * Handler del input de fecha del modal. Refresca el resumen batch para que
   * conflicto y faltantes/existentes correspondan a la nueva fecha.
   */
  onDialogDateChange(): void {
    this.loadDialogSheets();
  }

  /**
   * Trae las planillas ACTIVE del día elegido para alimentar el resumen del
   * modal (conflicto single + faltantes/existentes batch). NO usa los filtros
   * actuales del listado principal — apunta directamente a selectedDate para
   * que el resumen sea consistente sin depender del estado de la página.
   */
  private loadDialogSheets(): void {
    if (!this.selectedDate) {
      this.dialogSheets = [];
      return;
    }
    this.loadingDialogSheets = true;
    this.collectionsService
      .list({ date: this.selectedDate, includeRegenerated: false })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loadingDialogSheets = false)),
      )
      .subscribe({
        next: (sheets) => (this.dialogSheets = sheets),
        error: () => (this.dialogSheets = []),
      });
  }

  /**
   * Planilla ACTIVE existente para el cobrador específico (single mode) en la
   * fecha elegida. Alimenta el banner ámbar y el cambio de CTA a "Regenerar".
   * En modo batch (selectedCollectorId === 'ALL') siempre es null.
   */
  get conflictingSheet(): CollectionSheet | null {
    if (this.isBatchMode) return null;
    return (
      this.dialogSheets.find(
        (s) =>
          s.collectorId === this.selectedCollectorId && s.status === 'ACTIVE',
      ) ?? null
    );
  }

  /** Cobradores que YA tienen planilla ACTIVE para selectedDate. */
  get batchExistingCount(): number {
    return this.dialogSheets.filter((s) => s.status === 'ACTIVE').length;
  }

  /** Cobradores SIN planilla ACTIVE para selectedDate. */
  get batchMissingCount(): number {
    const activeCollectorIds = new Set(
      this.dialogSheets
        .filter((s) => s.status === 'ACTIVE')
        .map((s) => s.collectorId),
    );
    return this.collectors.filter((c) => !activeCollectorIds.has(c.id)).length;
  }

  /**
   * Label del único botón de acción del modal. Depende del modo y los
   * conteos/conflictos. Una sola acción visible, sin ambigüedad.
   */
  get submitLabel(): string {
    if (this.isBatchMode) {
      const missing = this.batchMissingCount;
      const existing = this.batchExistingCount;
      if (this.regenerateExisting) {
        if (existing > 0 && missing > 0)
          return `Regenerar ${existing} y generar ${missing}`;
        if (existing > 0) return `Regenerar ${existing}`;
        return `Generar ${missing}`;
      }
      if (missing > 0)
        return `Generar ${missing} planilla${missing === 1 ? '' : 's'}`;
      return 'Sin pendientes';
    }
    return this.conflictingSheet ? 'Regenerar planilla' : 'Generar planilla';
  }

  /** Severity de PrimeNG para el botón principal: warning si va a regenerar. */
  get submitSeverity(): 'primary' | 'warning' {
    if (this.isBatchMode) {
      return this.regenerateExisting && this.batchExistingCount > 0
        ? 'warning'
        : 'primary';
    }
    return this.conflictingSheet ? 'warning' : 'primary';
  }

  /** Deshabilita el botón principal cuando no hay acción válida posible. */
  get submitDisabled(): boolean {
    if (this.generating || this.generatingAll || this.loadingDialogSheets)
      return true;
    if (this.isBatchMode) {
      if (this.regenerateExisting) {
        return this.batchExistingCount + this.batchMissingCount === 0;
      }
      return this.batchMissingCount === 0;
    }
    return !this.selectedCollectorId; // single: requiere cobrador elegido
  }

  /**
   * Genera una planilla para el cobrador seleccionado en el diálogo.
   * Tras éxito, si la respuesta trae alertas operativas, muestra el diálogo
   * de alertas con `overdueNextVisits` priorizado (más crítico).
   */
  generatePlanilla(): void {
    if (this.isBatchMode || this.generating || this.generatingAll) return;
    if (this.selectedDate < this.todayIsoDate) {
      this.msg.add({
        severity: 'warn',
        summary: 'Fecha inválida',
        detail: 'No se puede generar una planilla para una fecha pasada.',
        life: 4000,
      });
      return;
    }
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
        next: (result: CollectionGenerateOutcome) => {
          if ('skipped' in result) {
            // El single NO envía skip_if_exists; este branch es solo defensivo
            // por si el contrato cambia en el futuro.
            this.msg.add({
              severity: 'info',
              summary: 'Sin cambios',
              detail: 'Ya existía una planilla activa para esta fecha.',
              life: 4000,
            });
            return;
          }
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
      collectorId: result.sheet.collectorId,
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
   *
   * Política según `regenerateExisting`:
   *   - false (default): skip_if_exists=true en cada llamado → backend NO toca
   *     los que ya tienen ACTIVE; solo genera para los faltantes.
   *   - true: skip_if_exists=false → backend regenera las existentes y crea
   *     las faltantes.
   *
   * Snapshot pre-batch de `dialogSheets` para clasificar resultados como
   * generated (nuevo) vs regenerated (existía y se reemplazó). El backend
   * comunica skipped explícitamente mediante el shape de la respuesta.
   */
  generateForAll(): void {
    if (this.generatingAll || this.generating) return;
    if (this.selectedDate < this.todayIsoDate) {
      this.msg.add({
        severity: 'warn',
        summary: 'Fecha inválida',
        detail: 'No se puede generar una planilla para una fecha pasada.',
        life: 4000,
      });
      return;
    }
    // Guarda equivalente a submitDisabled en batch mode, pero sin depender
    // del modo del dropdown (generateForAll también puede invocarse via submit()).
    if (this.loadingDialogSheets) return;
    const nothingToDo = this.regenerateExisting
      ? this.batchExistingCount + this.batchMissingCount === 0
      : this.batchMissingCount === 0;
    if (nothingToDo) return;

    const preExistingCollectorIds = new Set(
      this.dialogSheets
        .filter((s) => s.status === 'ACTIVE')
        .map((s) => s.collectorId),
    );
    const skipIfExists = !this.regenerateExisting;

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
                skipIfExists,
              })
              .pipe(
                map((result) => ({
                  success: true as const,
                  collectorId: c.id,
                  collectorName: c.fullName,
                  result,
                })),
                catchError((err: AppError) =>
                  of({
                    success: false as const,
                    collectorId: c.id,
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
              let generated = 0;
              let regenerated = 0;
              let skipped = 0;
              const failures: { collectorName: string; error: AppError }[] = [];
              let withAlerts = 0;

              for (const o of outcomes) {
                if (!o.success) {
                  failures.push({
                    collectorName: o.collectorName,
                    error: o.error,
                  });
                  continue;
                }
                if ('skipped' in o.result) {
                  skipped++;
                  continue;
                }
                if (preExistingCollectorIds.has(o.collectorId)) {
                  regenerated++;
                } else {
                  generated++;
                }
                if (
                  o.result.alerts.overdueNextVisits.length > 0 ||
                  o.result.alerts.unassignedCustomers.length > 0
                ) {
                  withAlerts++;
                }
              }

              const summaryParts: string[] = [];
              if (generated > 0)
                summaryParts.push(
                  `${generated} generada${generated === 1 ? '' : 's'}`,
                );
              if (regenerated > 0)
                summaryParts.push(
                  `${regenerated} regenerada${regenerated === 1 ? '' : 's'}`,
                );
              if (skipped > 0)
                summaryParts.push(
                  `${skipped} omitida${skipped === 1 ? '' : 's'}`,
                );
              const summary = summaryParts.join(' · ') || 'Sin cambios';

              const totalSuccess = generated + regenerated;
              if (totalSuccess > 0 || skipped > 0) {
                const alertsNote =
                  withAlerts > 0
                    ? ` ${withAlerts} con alertas operativas — abrilas para revisarlas.`
                    : '';
                this.msg.add({
                  severity: 'success',
                  summary: 'Planillas procesadas',
                  detail: `${summary}.${alertsNote}`,
                  life: 6000,
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
   * Descarga la planilla seleccionada como PDF imprimible, formato A4 portrait,
   * optimizado para uso operativo en calle: filas multi-línea con espacio
   * manual para anotar (Cobrado / Obs/Visita), referencia completa de la
   * cuota como protagonista y densidad de ~15-17 cuotas por página.
   *
   * Sin queries adicionales — reutiliza collection_reference que ya viaja.
   */
  downloadPdf(): void {
    if (!this.selectedSheet) return;
    const result = this.mapDetailToResult(this.selectedSheet);
    const doc = new jsPDF('p', 'mm', 'a4');

    // ── Layout constants (mm) ───────────────────────────────────────────────
    const PAGE_W = doc.internal.pageSize.getWidth();   // 210
    const PAGE_H = doc.internal.pageSize.getHeight();  // 297
    const MARGIN_X = 14;
    const MARGIN_TOP = 18;
    const MARGIN_BOTTOM = 18;
    const CONTENT_W = PAGE_W - MARGIN_X * 2; // 182
    const FOOTER_H = 8;
    const ROW_H_BASE = 14;
    const ROW_H_WRAPPED = 18;  // cuando collectionReference toma 2 líneas
    const TABLE_HEADER_H = 6;
    const HEADER_H = 26;

    const COLS = {
      num: { x: MARGIN_X,             w: 8  },
      cli: { x: MARGIN_X + 8,         w: 76 },
      ven: { x: MARGIN_X + 84,        w: 18 },
      esp: { x: MARGIN_X + 102,       w: 24 },
      ges: { x: MARGIN_X + 126,       w: 56 },
    };

    const COLOR_TEXT = [33, 37, 41] as const;
    const COLOR_MUTED = [108, 117, 125] as const;
    const COLOR_BORDER = [220, 220, 224] as const;
    const COLOR_BORDER_STRONG = [120, 120, 130] as const;
    const COLOR_HEADER_BG = [245, 247, 250] as const;

    const folio = (result.sheetId ?? '').slice(0, 8) || '—';
    const issuedAt = (() => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    })();

    const filterLabel = COLLECTION_FILTER_LABELS[this.selectedSheet.filterUsed] ?? '—';

    // ── Helpers ─────────────────────────────────────────────────────────────
    const setFont = (size: number, weight: 'normal' | 'bold' = 'normal') => {
      doc.setFont('helvetica', weight);
      doc.setFontSize(size);
    };
    const setColor = (rgb: readonly [number, number, number]) => {
      doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    };
    const setStroke = (rgb: readonly [number, number, number], width: number) => {
      doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
      doc.setLineWidth(width);
    };

    const drawPdfHeader = (): void => {
      // Caja contenedora
      setStroke(COLOR_BORDER, 0.3);
      doc.rect(MARGIN_X, MARGIN_TOP, CONTENT_W, HEADER_H);
      // Título
      setFont(13, 'bold');
      setColor(COLOR_TEXT);
      doc.text('PLANILLA DE COBRANZA', MARGIN_X + 3, MARGIN_TOP + 6);
      // Folio (derecha)
      setFont(8, 'normal');
      setColor(COLOR_MUTED);
      doc.text(`Folio  ${folio}`, MARGIN_X + CONTENT_W - 3, MARGIN_TOP + 6, { align: 'right' });
      // Subtítulo
      setFont(8, 'normal');
      doc.text('Documento operativo de cobranza', MARGIN_X + 3, MARGIN_TOP + 11);
      // Línea separadora interna
      setStroke(COLOR_BORDER, 0.2);
      doc.line(MARGIN_X + 3, MARGIN_TOP + 13.5, MARGIN_X + CONTENT_W - 3, MARGIN_TOP + 13.5);
      // Línea 3: Cobrador · Fecha · Filtro
      setFont(9, 'normal');
      setColor(COLOR_TEXT);
      doc.text(
        `Cobrador: ${result.collectorName}     Fecha: ${this.formatDate(result.fecha)}     Filtro: ${filterLabel}`,
        MARGIN_X + 3,
        MARGIN_TOP + 18,
      );
      // Línea 4: Cuotas · Total esperado
      doc.text(
        `Cuotas: ${result.clientCount}     Total esperado: ${this.formatCurrency(result.totalAmount)}`,
        MARGIN_X + 3,
        MARGIN_TOP + 23,
      );
    };

    const drawTableHeader = (yTop: number): void => {
      // Fondo
      doc.setFillColor(COLOR_HEADER_BG[0], COLOR_HEADER_BG[1], COLOR_HEADER_BG[2]);
      doc.rect(MARGIN_X, yTop, CONTENT_W, TABLE_HEADER_H, 'F');
      // Bordes superior e inferior
      setStroke(COLOR_BORDER_STRONG, 0.4);
      doc.line(MARGIN_X, yTop, MARGIN_X + CONTENT_W, yTop);
      doc.line(MARGIN_X, yTop + TABLE_HEADER_H, MARGIN_X + CONTENT_W, yTop + TABLE_HEADER_H);
      // Labels
      setFont(7.5, 'bold');
      setColor(COLOR_MUTED);
      const textY = yTop + 4;
      doc.text('#', COLS.num.x + COLS.num.w / 2, textY, { align: 'center' });
      doc.text('CLIENTE', COLS.cli.x + 1.5, textY);
      doc.text('VENCE', COLS.ven.x + COLS.ven.w / 2, textY, { align: 'center' });
      doc.text('ESPERADO', COLS.esp.x + COLS.esp.w / 2, textY, { align: 'center' });
      doc.text('GESTIÓN', COLS.ges.x + 1.5, textY);
    };

    /**
     * Compone la línea de contacto (teléfono · dirección) para la columna
     * CLIENTE. Recorta para que entre en el ancho disponible. Devuelve '' si
     * no hay datos — la fila simplemente no la dibuja.
     */
    const composeContactLine = (entry: PlanillaEntry): string => {
      const parts: string[] = [];
      if (entry.clientPhone) parts.push(entry.clientPhone);
      if (entry.clientAddress) parts.push(entry.clientAddress);
      return parts.join('  ·  ');
    };

    /**
     * Mide la altura efectiva de una fila considerando si collectionReference
     * necesita 2 líneas y si hay línea de contacto. Devuelve refLines (max 2)
     * y contactLine ya recortada al ancho disponible.
     */
    const measureRow = (entry: PlanillaEntry): {
      height: number;
      refLines: string[];
      contactLine: string;
    } => {
      setFont(7.5, 'normal');
      const ref = entry.collectionReference || `Cuota ${entry.installmentNumber} · —`;
      const refLines = (doc.splitTextToSize(ref, COLS.cli.w - 3) as string[]).slice(0, 2);
      const contactRaw = composeContactLine(entry);
      // Recorto contacto a 1 línea: si no entra en el ancho, splitTextToSize
      // devuelve varias; me quedo con la primera.
      const contactLine = contactRaw
        ? (doc.splitTextToSize(contactRaw, COLS.cli.w - 3) as string[])[0]
        : '';
      // Altura: cuento líneas internas en la columna CLIENTE (la más alta).
      //   1 línea de nombre  +  refLines  +  (1 si hay contacto)
      // ROW_H_BASE cubre 2 líneas internas; ROW_H_WRAPPED cubre 3; >3 → 21mm.
      const internalLines = 1 + refLines.length + (contactLine ? 1 : 0);
      let height: number;
      if (internalLines <= 2) height = ROW_H_BASE;          // 14mm
      else if (internalLines === 3) height = ROW_H_WRAPPED; // 18mm
      else height = 21;                                     // ref 2 líneas + contacto
      return { height, refLines, contactLine };
    };

    const drawRow = (
      entry: PlanillaEntry,
      index: number,
      yTop: number,
      isFifth: boolean,
      refLines: string[],
      contactLine: string,
      height: number,
    ): void => {
      const innerTop = yTop + 4;        // línea 1: nombre cliente / fecha / cobrado
      const innerSecond = yTop + 7.7;   // línea 2: ref (o ref-1) / estado / obs-visita
      // línea 3 dentro de CLIENTE: si la ref se wrappea ocupa innerSecond+3.5,
      // si no, esa posición la usa la línea de contacto.

      // Borde superior (fino o grueso cada 5)
      setStroke(
        isFifth ? COLOR_BORDER_STRONG : COLOR_BORDER,
        isFifth ? 0.5 : 0.15,
      );
      doc.line(MARGIN_X, yTop, MARGIN_X + CONTENT_W, yTop);

      // ── # de orden ───────────────────────────────────────────────────────
      setFont(8.5, 'normal');
      setColor(COLOR_MUTED);
      doc.text(
        String(index + 1).padStart(2, '0'),
        COLS.num.x + COLS.num.w / 2,
        innerTop,
        { align: 'center' },
      );

      // ── Cliente: nombre + ref + contacto ────────────────────────────────
      setFont(9.5, 'bold');
      setColor(COLOR_TEXT);
      const clientName = (entry.clientName ?? '').toUpperCase();
      const clientFit = doc.splitTextToSize(clientName, COLS.cli.w - 3)[0] ?? clientName;
      doc.text(clientFit, COLS.cli.x + 1.5, innerTop);

      // Contacto (línea 2) + referencia debajo. El nombre queda arriba, los
      // datos de contacto pegados al nombre y la referencia (que puede ocupar
      // 2 líneas con wrap) al final.
      setFont(7.5, 'normal');
      setColor(COLOR_MUTED);
      let nextY = innerSecond;
      if (contactLine) {
        doc.text(contactLine, COLS.cli.x + 1.5, nextY);
        nextY += 3.3;
      }
      refLines.forEach((line, i) => {
        doc.text(line, COLS.cli.x + 1.5, nextY + i * 3.3);
      });

      // ── Vence (línea 1) + Estado (línea 2) ──────────────────────────────
      setFont(8.5, 'normal');
      setColor(COLOR_TEXT);
      doc.text(
        this.formatDate(entry.dueDate),
        COLS.ven.x + COLS.ven.w / 2,
        innerTop,
        { align: 'center' },
      );
      setFont(7.5, 'bold');
      setColor(statusColor(entry.paymentStatus));
      doc.text(
        entry.paymentStatus.toUpperCase(),
        COLS.ven.x + COLS.ven.w / 2,
        innerSecond,
        { align: 'center' },
      );

      // ── Esperado (línea única centrada vertical) ────────────────────────
      setFont(10.5, 'bold');
      setColor(COLOR_TEXT);
      doc.text(
        this.formatCurrency(entry.amount),
        COLS.esp.x + COLS.esp.w / 2,
        yTop + height / 2 + 1.5,
        { align: 'center' },
      );

      // ── Gestión: Cobrado (línea 1) + Obs/Visita (línea 2) ───────────────
      setFont(7.5, 'normal');
      setColor(COLOR_MUTED);
      const gesX = COLS.ges.x + 1.5;
      const gesLineEnd = COLS.ges.x + COLS.ges.w - 1.5;

      doc.text('Cobrado:', gesX, innerTop);
      setStroke(COLOR_BORDER_STRONG, 0.25);
      doc.line(gesX + 13, innerTop + 0.5, gesLineEnd, innerTop + 0.5);

      doc.text('Obs/Visita:', gesX, innerSecond);
      doc.line(gesX + 16, innerSecond + 0.5, gesLineEnd, innerSecond + 0.5);
    };

    /**
     * Devuelve un color hex para el estado (sutil, sin fondo, sin badge).
     */
    function statusColor(status: string): readonly [number, number, number] {
      switch (status) {
        case 'EN_MORA':   return [185, 28, 28];   // rojo sobrio
        case 'PARCIAL':   return [180, 83, 9];    // ámbar
        case 'COBRADO':   return [21, 128, 61];   // verde
        case 'PENDIENTE':
        default:          return [55, 65, 81];    // gris oscuro
      }
    }

    const drawFooter = (pageNum: number, totalPages: number): void => {
      setFont(7, 'normal');
      setColor(COLOR_MUTED);
      const text = `Página ${pageNum} de ${totalPages}  ·  Emitido ${issuedAt}  ·  ${result.collectorName}  ·  ${this.formatDate(result.fecha)}`;
      doc.text(text, PAGE_W / 2, PAGE_H - MARGIN_BOTTOM / 2 - 2, { align: 'center' });
    };

    // ── Paginación: pre-calcular qué fila va a qué página ───────────────────
    // Esto permite saber el totalPages para el footer ANTES de empezar a
    // dibujar, y garantiza que las filas NO se corten entre páginas.
    const rowMeasures = result.entries.map((e) => measureRow(e));
    const pageRowsBudget = PAGE_H - MARGIN_TOP - HEADER_H - TABLE_HEADER_H - MARGIN_BOTTOM - FOOTER_H;
    type RowMeasure = { height: number; refLines: string[]; contactLine: string };
    const pageBuckets: { entries: PlanillaEntry[]; measures: RowMeasure[] }[] = [];
    let bucket: { entries: PlanillaEntry[]; measures: RowMeasure[] } = { entries: [], measures: [] };
    let used = 0;
    for (let i = 0; i < result.entries.length; i++) {
      const m = rowMeasures[i];
      if (used + m.height > pageRowsBudget && bucket.entries.length > 0) {
        pageBuckets.push(bucket);
        bucket = { entries: [], measures: [] };
        used = 0;
      }
      bucket.entries.push(result.entries[i]);
      bucket.measures.push(m);
      used += m.height;
    }
    if (bucket.entries.length > 0) pageBuckets.push(bucket);
    const totalPages = Math.max(pageBuckets.length, 1);

    // ── Render por página ───────────────────────────────────────────────────
    pageBuckets.forEach((page, pageIdx) => {
      if (pageIdx > 0) doc.addPage();
      drawPdfHeader();
      const tableY = MARGIN_TOP + HEADER_H + 2;
      drawTableHeader(tableY);
      let y = tableY + TABLE_HEADER_H;
      const globalStartIndex = pageBuckets
        .slice(0, pageIdx)
        .reduce((acc, p) => acc + p.entries.length, 0);
      page.entries.forEach((entry, localIdx) => {
        const globalIdx = globalStartIndex + localIdx;
        const isFifth = globalIdx > 0 && globalIdx % 5 === 0;
        drawRow(
          entry,
          globalIdx,
          y,
          isFifth,
          page.measures[localIdx].refLines,
          page.measures[localIdx].contactLine,
          page.measures[localIdx].height,
        );
        y += page.measures[localIdx].height;
      });
      // Borde inferior final de la tabla
      setStroke(COLOR_BORDER_STRONG, 0.4);
      doc.line(MARGIN_X, y, MARGIN_X + CONTENT_W, y);
      drawFooter(pageIdx + 1, totalPages);
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
   * Abre/cierra el panel del log para una cuota; carga si no hay cache.
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
      collectionReference: item.collectionReference,
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
