import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { Subject } from 'rxjs';
import { debounceTime, switchMap, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../core/models/app-error';
import { DateService } from '../../../core/services/date.service';
import { FormatService } from '../../../core/services/format.service';
import { HeaderService } from '../../../core/services/header.service';
import { ErrorStateComponent } from '../../../shared/states/error-state/error-state.component';
import { CollectionsService } from '../../collector/collections.service';
import {
  COLLECTION_FILTER_LABELS,
  CollectionAlerts,
  CollectionFilter,
  CollectionGenerateResult,
  CollectionSheet,
  SHEET_STATUS_LABELS,
} from '../../collector/models/collection.model';
import { User } from '../users/user.model';
import { UsersService } from '../users/users.service';
import { CollectionAlertsDialogComponent } from './collection-alerts-dialog/collection-alerts-dialog.component';
import {
  CollectionSheetDetailPanelComponent,
  DetailTab,
} from './collection-sheet-detail-panel/collection-sheet-detail-panel.component';
import { GenerateCollectionDialogComponent } from './generate-collection-dialog/generate-collection-dialog.component';

@Component({
  selector: 'app-admin-collections',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    CalendarModule,
    CardModule,
    DropdownModule,
    InputSwitchModule,
    SkeletonModule,
    TableModule,
    TagModule,
    ToastModule,
    TooltipModule,
    ErrorStateComponent,
    GenerateCollectionDialogComponent,
    CollectionSheetDetailPanelComponent,
    CollectionAlertsDialogComponent,
  ],
  providers: [MessageService],
  templateUrl: './admin-collections.component.html',
  styleUrl: './admin-collections.component.scss',
})
export class AdminCollectionsComponent implements OnInit, OnDestroy {
  private readonly collectionsService = inject(CollectionsService);
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly header = inject(HeaderService);
  private readonly msg = inject(MessageService);
  readonly format = inject(FormatService);
  readonly dateSvc = inject(DateService);
  readonly today = new Date();
  private destroy$ = new Subject<void>();

  sheets: CollectionSheet[] = [];
  collectors: User[] = [];
  loading = true;
  error: AppError | null = null;
  filterCollectorId: string | null = null;
  filterDate = this.dateSvc.toLocalIso(new Date());
  filterIncludeRegenerated = false;
  filterUsed: CollectionFilter | null = null;

  readonly filterUsedOptions: { label: string; value: CollectionFilter }[] = [
    { label: 'Solo vencidas', value: 'OVERDUE' },
    { label: 'Del día', value: 'TODAY' },
    { label: 'Vencidas + hoy', value: 'TODAY_AND_OVERDUE' },
    { label: 'Todas pendientes', value: 'ALL_PENDING' },
  ];

  get visibleSheets(): CollectionSheet[] {
    if (!this.filterUsed) return this.sheets;
    return this.sheets.filter((s) => s.filterUsed === this.filterUsed);
  }

  showAlertsDialog = false;
  lastAlerts: CollectionAlerts | null = null;

  readonly SHEET_STATUS_LABELS = SHEET_STATUS_LABELS;

  selectedSheetMeta: CollectionSheet | null = null;
  openTabForPanel: DetailTab | null = null;
  leftPanelCollapsed = false;

  showGenerateDialog = false;

  private pendingOpenSheetId: string | null = null;
  private pendingOpenTab: DetailTab | null = null;
  private readonly load$ = new Subject<void>();

  /**
   * Opciones de cobrador para el dropdown del filtro.
   */
  get collectorOptions(): { label: string; value: string }[] {
    return this.collectors.map((c) => ({ label: c.fullName, value: c.id }));
  }

  ngOnInit(): void {
    this.header.set([{ label: 'Planillas de cobro' }]);
    this.pendingOpenSheetId =
      this.route.snapshot.queryParamMap.get('openSheetId');
    const tabParam = this.route.snapshot.queryParamMap.get('openTab');
    if (
      tabParam &&
      ['ALL', 'PENDING', 'OVERDUE', 'PARTIAL', 'PAID'].includes(tabParam)
    ) {
      this.pendingOpenTab = tabParam as DetailTab;
    }
    this.usersService
      .listCollectors()
      .pipe(takeUntil(this.destroy$))
      .subscribe((c) => (this.collectors = c));

    this.load$
      .pipe(
        debounceTime(150),
        switchMap(() => {
          this.loading = true;
          this.error = null;
          const filters: { collectorId?: string; date?: string; includeRegenerated?: boolean } = {};
          if (this.filterCollectorId) filters.collectorId = this.filterCollectorId;
          if (this.filterDate) filters.date = this.filterDate;
          if (this.filterIncludeRegenerated) filters.includeRegenerated = true;
          return this.collectionsService.list(filters);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (data) => {
          this.sheets = data;
          this.loading = false;
          if (this.pendingOpenSheetId) {
            const sheetToOpen = data.find((s) => s.id === this.pendingOpenSheetId);
            this.pendingOpenSheetId = null;
            this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
            if (sheetToOpen) {
              this.openTabForPanel = this.pendingOpenTab;
              this.selectedSheetMeta = sheetToOpen;
            }
            this.pendingOpenTab = null;
          }
        },
        error: (err: AppError) => {
          this.error = err;
          this.loading = false;
        },
      });

    this.load();
    this.maybeAutoOpenGenerate();
  }

  /**
   * Abre automáticamente el diálogo de generación si llegamos con ?openGenerate=true.
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
   * Recarga la lista con los filtros activos.
   */
  applyFilters(): void {
    this.load();
  }

  /**
   * Limpia los filtros y recarga la lista completa.
   */
  clearFilters(): void {
    this.filterCollectorId = null;
    this.filterDate = this.dateSvc.toLocalIso(new Date());
    this.filterIncludeRegenerated = false;
    this.filterUsed = null;
    this.load();
  }

  /**
   * Selecciona una planilla y carga su detalle en el panel derecho.
   * @param sheet Planilla seleccionada de la lista
   */
  selectSheet(sheet: CollectionSheet): void {
    this.selectedSheetMeta = sheet;
    this.openTabForPanel = null;
    this.resetShellScroll();
  }

  /**
   * Cierra el panel de detalle y resetea el estado de colapso.
   */
  onDetailClosed(): void {
    this.selectedSheetMeta = null;
    this.leftPanelCollapsed = false;
    this.resetShellScroll();
  }

  /**
   * Resetea el scroll del shell para que el cambio lista/detalle mobile no
   * deje el header de la nueva vista recortado por la posicion anterior.
   */
  private resetShellScroll(): void {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.ff-shell__main')?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    });
  }

  /**
   * Abre el diálogo de generación de planilla.
   */
  openGenerateDialog(): void {
    this.showGenerateDialog = true;
  }

  /**
   * Handler del evento planillaGenerated: aplica el resultado y recarga la lista.
   * @param result Resultado de la generación emitido por el diálogo hijo
   */
  onPlanillaGenerated(result: CollectionGenerateResult): void {
    this.applyGenerationResult(result);
    this.load();
  }

  /**
   * Handler del evento batchCompleted: recarga la lista tras una generación batch.
   */
  onBatchCompleted(): void {
    this.load();
  }

  /**
   * Aplica el resultado de una generación al panel derecho y dispara el diálogo de alertas.
   */
  private applyGenerationResult(result: CollectionGenerateResult): void {
    this.selectedSheetMeta = {
      id: result.sheet.id,
      sheetDate: result.sheet.sheetDate,
      filterUsed: result.sheet.filterUsed,
      status: result.sheet.status,
      createdAt: result.sheet.createdAt,
      sentAt: result.sheet.sentAt,
      collectorId: result.sheet.collectorId,
      collectorName: result.sheet.collectorName,
      totalItems: result.sheet.totalItems,
    };
    this.openTabForPanel = null;
    this.leftPanelCollapsed = false;

    this.lastAlerts = result.alerts;
    const hasOverdue = result.alerts.overdueNextVisits.length > 0;
    const hasUnassigned = result.alerts.unassignedCustomers.length > 0;

    if (hasOverdue || hasUnassigned) {
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
   * Dispara una recarga de planillas. Debounceado — llamadas rápidas colapsan en una sola.
   */
  private load(): void {
    this.load$.next();
  }

}

