import { DatePipe } from '@angular/common';
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
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { TooltipModule } from 'primeng/tooltip';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, map, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../../core/models/app-error';
import { DateService } from '../../../../core/services/date.service';
import { CollectionsService } from '../../../collector/collections.service';
import {
  CollectionFilter,
  CollectionGenerateOutcome,
  CollectionGenerateResult,
  CollectionSheet,
} from '../../../collector/models/collection.model';
import { User } from '../../users/user.model';

@Component({
  selector: 'app-generate-collection-dialog',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    CalendarModule,
    DialogModule,
    DropdownModule,
    InputSwitchModule,
    TooltipModule,
  ],
  templateUrl: './generate-collection-dialog.component.html',
  styleUrl: './generate-collection-dialog.component.scss',
})
export class GenerateCollectionDialogComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** Lista de cobradores activos cargada por el padre. */
  @Input() collectors: User[] = [];
  /** Emite cuando se generó una planilla individual. El padre aplica el resultado y recarga. */
  @Output() planillaGenerated = new EventEmitter<CollectionGenerateResult>();
  /** Emite cuando el batch completó (toast ya mostrado por el dialog). El padre recarga. */
  @Output() batchCompleted = new EventEmitter<void>();

  readonly ALL_COLLECTORS = 'ALL';

  private readonly collectionsService = inject(CollectionsService);
  private readonly msg = inject(MessageService);
  private readonly dateSvc = inject(DateService);

  readonly todayDate: Date = this.dateSvc.startOfToday();
  selectedCollectorId: string = this.ALL_COLLECTORS;
  selectedDate: string = this.dateSvc.toLocalIso(new Date());
  selectedFilter: CollectionFilter = 'TODAY';
  /**
   * Etiquetas y leyendas alineadas con la semantica real de cada filtro
   * (auditoria de planillas). Se omite TODAY_AND_OVERDUE: devuelve
   * practicamente el mismo conjunto que TODAY y el operador no nota
   * diferencia. Se mantiene el tipo CollectionFilter para compat con
   * planillas pre-existentes que se hayan generado con ese valor.
   */
  filterOptions: { label: string; value: CollectionFilter; description: string }[] = [
    {
      label:       'Para cobrar hoy',
      value:       'TODAY',
      description: 'Cuotas que vencen hoy + visitas agendadas para hoy. No incluye mora vieja.',
    },
    {
      label:       'Vencidas sin agenda',
      value:       'OVERDUE',
      description: 'Cuotas en mora cuya proxima visita ya paso o nunca se agendo. No incluye vencidas con visita hoy.',
    },
    {
      label:       'Todas las pendientes',
      value:       'ALL_PENDING',
      description: 'Todas las cuotas del cobrador con saldo > 0, sin filtrar por fecha ni agenda.',
    },
  ];

  /**
   * Descripcion del filtro actualmente seleccionado para mostrar debajo del
   * dropdown. Si el valor no aparece en filterOptions (p. ej. una planilla
   * vieja con TODAY_AND_OVERDUE) devuelve cadena vacia y el bloque se oculta.
   */
  get selectedFilterDescription(): string {
    return this.filterOptions.find((o) => o.value === this.selectedFilter)?.description ?? '';
  }
  generating = false;
  generatingAll = false;
  dialogSheets: CollectionSheet[] = [];
  loadingDialogSheets = false;
  regenerateExisting = false;

  private destroy$ = new Subject<void>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.selectedDate = this.dateSvc.toLocalIso(new Date());
      this.selectedCollectorId = this.ALL_COLLECTORS;
      this.regenerateExisting = false;
      this.loadDialogSheets();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cierra el diálogo emitiendo el cambio de visibilidad al padre.
   */
  close(): void {
    this.visibleChange.emit(false);
  }

  /**
   * Opciones del dropdown del modal con "Todos los cobradores" como primer ítem.
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

  /** True si el dropdown está en modo "todos los cobradores". */
  get isBatchMode(): boolean {
    return this.selectedCollectorId === this.ALL_COLLECTORS;
  }

  /** Nombre del cobrador seleccionado en single mode, o '' en batch. */
  get selectedCollectorName(): string {
    if (this.isBatchMode) return '';
    return (
      this.collectors.find((c) => c.id === this.selectedCollectorId)
        ?.fullName ?? ''
    );
  }

  /**
   * Planilla ACTIVE existente para el cobrador específico en la fecha elegida.
   * Siempre null en batch mode.
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
    const activeIds = new Set(
      this.dialogSheets
        .filter((s) => s.status === 'ACTIVE')
        .map((s) => s.collectorId),
    );
    return this.collectors.filter((c) => !activeIds.has(c.id)).length;
  }

  /** Lista de nombres de cobradores con planilla ACTIVE. */
  get batchExistingCollectorNames(): string[] {
    const byId = new Map(this.collectors.map((c) => [c.id, c.fullName]));
    return this.dialogSheets
      .filter((s) => s.status === 'ACTIVE')
      .map((s) => byId.get(s.collectorId) ?? s.collectorName)
      .filter((name, idx, arr) => !!name && arr.indexOf(name) === idx);
  }

  /** Lista de nombres de cobradores sin planilla ACTIVE. */
  get batchMissingCollectorNames(): string[] {
    const activeIds = new Set(
      this.dialogSheets
        .filter((s) => s.status === 'ACTIVE')
        .map((s) => s.collectorId),
    );
    return this.collectors
      .filter((c) => !activeIds.has(c.id))
      .map((c) => c.fullName);
  }

  /**
   * Label del botón de acción según modo y estado del día.
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

  /** Severity del botón principal: warning si va a regenerar. */
  get submitSeverity(): 'primary' | 'warning' {
    if (this.isBatchMode) {
      return this.regenerateExisting && this.batchExistingCount > 0
        ? 'warning'
        : 'primary';
    }
    return this.conflictingSheet ? 'warning' : 'primary';
  }

  /** Deshabilita el botón cuando no hay acción válida. */
  get submitDisabled(): boolean {
    if (this.generating || this.generatingAll || this.loadingDialogSheets)
      return true;
    if (this.isBatchMode) {
      return this.regenerateExisting
        ? this.batchExistingCount + this.batchMissingCount === 0
        : this.batchMissingCount === 0;
    }
    return !this.selectedCollectorId;
  }

  /**
   * Punto de entrada unificado: despacha al flujo batch o individual.
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
   * Handler del cambio de fecha: refresca el resumen del día.
   */
  onDialogDateChange(): void {
    this.loadDialogSheets();
  }

  /**
   * Alterna el toggle de regeneración al hacer click en la tarjeta,
   * evitando dobles cambios cuando el click ocurre sobre el switch.
   * @param event Evento click del contenedor
   */
  onRegenerateBoxClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.p-inputswitch')) return;
    this.regenerateExisting = !this.regenerateExisting;
  }

  /**
   * Carga las planillas ACTIVE del día elegido para alimentar el resumen del modal.
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
   * Genera una planilla para el cobrador seleccionado y emite el resultado al padre.
   */
  private generatePlanilla(): void {
    if (this.isBatchMode || this.generating || this.generatingAll) return;
    if (this.isDateInPast()) return;
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
            this.msg.add({
              severity: 'info',
              summary: 'Sin cambios',
              detail: 'Ya existía una planilla activa para esta fecha.',
              life: 4000,
            });
            return;
          }
          this.close();
          this.planillaGenerated.emit(result);
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
   * Genera planillas para todos los cobradores en paralelo.
   * Muestra toast de resultado y emite batchCompleted para que el padre recargue.
   */
  private generateForAll(): void {
    if (this.generatingAll || this.generating || this.loadingDialogSheets)
      return;
    if (this.isDateInPast()) return;
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
    const collectors = this.collectors;

    if (collectors.length === 0) return;

    this.generatingAll = true;
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
      .subscribe((outcomes) =>
        this.handleBatchOutcomes(outcomes, preExistingCollectorIds),
      );
  }

  /**
   * Procesa los resultados del batch: contabiliza éxitos, regeneraciones,
   * omisiones y errores, y muestra los toasts correspondientes.
   * @param outcomes - Resultados individuales de cada request en paralelo.
   * @param preExistingIds - IDs de cobradores que ya tenían planilla activa antes del batch.
   */
  private handleBatchOutcomes(
    outcomes: Array<
      | { success: true; collectorId: string; collectorName: string; result: CollectionGenerateOutcome }
      | { success: false; collectorId: string; collectorName: string; error: AppError }
    >,
    preExistingIds: Set<string>,
  ): void {
    let generated = 0;
    let regenerated = 0;
    let skipped = 0;
    const failures: { collectorName: string; error: AppError }[] = [];
    let withAlerts = 0;

    for (const o of outcomes) {
      if (!o.success) {
        failures.push({ collectorName: o.collectorName, error: o.error });
        continue;
      }
      if ('skipped' in o.result) {
        skipped++;
        continue;
      }
      if (preExistingIds.has(o.collectorId)) {
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
      summaryParts.push(`${generated} generada${generated === 1 ? '' : 's'}`);
    if (regenerated > 0)
      summaryParts.push(
        `${regenerated} regenerada${regenerated === 1 ? '' : 's'}`,
      );
    if (skipped > 0)
      summaryParts.push(`${skipped} omitida${skipped === 1 ? '' : 's'}`);
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
      this.close();
      this.batchCompleted.emit();
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
  }

  /**
   * Valida si la fecha seleccionada es anterior a hoy y muestra toast si corresponde.
   * @returns {boolean} True si la fecha es pasada y la acción debe abortarse.
   */
  private isDateInPast(): boolean {
    if (this.selectedDate >= this.dateSvc.toLocalIso(new Date())) return false;
    this.msg.add({
      severity: 'warn',
      summary: 'Fecha inválida',
      detail: 'No se puede generar una planilla para una fecha pasada.',
      life: 4000,
    });
    return true;
  }
}
