import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, map, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../core/models/app-error';
import { FormatService } from '../../../core/services/format.service';
import { HeaderService } from '../../../core/services/header.service';
import { ErrorStateComponent } from '../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/states/loading-state/loading-state.component';
import { CollectionsService } from '../../collector/collections.service';
import {
  COLLECTION_FILTER_LABELS,
  CollectionFilter,
  CollectionSheet,
  CollectionSheetDetail,
} from '../../collector/models/collection.model';
import {
  GeneratedPlanillaResult,
  PlanillaEntry,
} from '../models/interface/sheet';
import { UsersService } from '../users/users.service';

@Component({
  selector: 'app-sheet',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CardModule,
    DialogModule,
    DropdownModule,
    SkeletonModule,
    TableModule,
    TagModule,
    ToastModule,
    TooltipModule,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  providers: [MessageService],
  templateUrl: './sheet.component.html',
  styleUrl: './sheet.component.scss',
})
export class SheetComponent implements OnInit, OnDestroy {
  private readonly collectionsService = inject(CollectionsService);
  private readonly usersService = inject(UsersService);
  private readonly header = inject(HeaderService);
  private readonly msg = inject(MessageService);
  readonly format = inject(FormatService);
  private destroy$ = new Subject<void>();

  collectorOptions: { label: string; value: string }[] = [];
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
  results: GeneratedPlanillaResult[] = [];

  historial: CollectionSheet[] = [];
  loadingHistorial = true;

  showReviewDialog = false;
  reviewSheetDetail: CollectionSheetDetail | null = null;
  loadingReview = false;

  ngOnInit(): void {
    this.header.set([{ label: 'Planilla' }]);
    this.usersService
      .listCollectors()
      .pipe(takeUntil(this.destroy$))
      .subscribe((collectors) => {
        this.collectorOptions = collectors.map((c) => ({
          label: c.fullName,
          value: c.id,
        }));
      });
    this.loadHistorial();
  }

  ngOnDestroy(): void {
    this.header.reset();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga el historial de planillas generadas, mostrando un estado de carga mientras se realiza la petición y actualizando la lista de planillas al finalizar. En caso de error, simplemente oculta el estado de carga sin modificar el historial (se asume que el error se maneja a nivel global o con un interceptor).
   */
  loadHistorial(): void {
    this.loadingHistorial = true;
    this.collectionsService
      .list()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingHistorial = false;
        }),
      )
      .subscribe({
        next: (sheets) => {
          this.historial = sheets;
        },
        error: () => {},
      });
  }

  /**
   * Genera una planilla para el cobrador seleccionado evitando reentradas mientras ya hay una generación en curso.
   */
  generatePlanilla(): void {
    if (!this.selectedCollectorId || this.generating || this.generatingAll) return;
    this.generating = true;
    this.collectionsService
      .generate({
        collectorId: this.selectedCollectorId,
        date: this.selectedDate,
        filter: this.selectedFilter,
      })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.generating = false;
        }),
      )
      .subscribe({
        next: (detail) => {
          this.results = [this.mapDetailToResult(detail), ...this.results];
          this.loadHistorial();
        },
        error: (err: AppError) => {
          if (err.status === 409) {
            this.msg.add({
              severity: 'warn',
              summary: 'Sin cuotas',
              detail:
                err.message ?? 'No hay cuotas para ese cobrador y filtro.',
              life: 5000,
            });
          } else {
            this.msg.add({
              severity: 'error',
              summary: 'Error',
              detail: err.message ?? 'No se pudo generar la planilla.',
              life: 5000,
            });
          }
        },
      });
  }

  /**
   * Genera planillas para todos los cobradores y evita ejecuciones concurrentes desde re-clicks.
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
                map((detail) => ({
                  success: true as const,
                  result: this.mapDetailToResult(detail),
                  collectorName: c.fullName,
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
              finalize(() => {
                this.generatingAll = false;
              }),
            )
            .subscribe((outcomes) => {
              const successes = outcomes.filter((o) => o.success);
              const failures = outcomes.filter((o) => !o.success);
              if (successes.length > 0) {
                const newResults = (
                  successes as Array<{
                    success: true;
                    result: GeneratedPlanillaResult;
                    collectorName: string;
                  }>
                ).map((o) => o.result);
                this.results = [...newResults, ...this.results];
                this.loadHistorial();
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
        error: () => {
          this.generatingAll = false;
        },
      });
  }

  /**
   * Descarga la planilla en formato PDF.
   * @param result
   */
  downloadPdf(result: GeneratedPlanillaResult): void {
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

    const colWidths = [55, 20, 18, 20, 28, 32];
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
      if (y > 272) {
        doc.addPage();
        y = 20;
      }
      if (idx % 2 === 0) {
        doc.setFillColor(245, 247, 250);
        doc.rect(startX, y - 4, tableWidth, 6, 'F');
      }
      x = startX;
      const row = [
        entry.clientName.substring(0, 30),
        entry.creditType === 'SALE' ? 'Venta' : 'Préstamo',
        String(entry.installmentNumber),
        entry.paymentStatus,
        this.formatDate(entry.dueDate),
        this.formatCurrency(entry.amount),
      ];
      row.forEach((cell, i) => {
        doc.text(cell, x + 2, y);
        x += colWidths[i];
      });
      y += 6;
    });

    doc.save(
      `planilla-${result.collectorName.replace(/\s+/g, '-')}-${result.fecha}.pdf`,
    );
  }

  /**
   * Muestra los detalles de una planilla específica.
   * @param sheetId
   */
  viewDetails(sheetId: string): void {
    this.showReviewDialog = true;
    this.reviewSheetDetail = null;
    this.loadingReview = true;
    this.collectionsService
      .getById(sheetId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingReview = false;
        }),
      )
      .subscribe({
        next: (detail) => {
          this.reviewSheetDetail = detail;
        },
        error: () => {
          this.showReviewDialog = false;
        },
      });
  }

  /**
   * Descarga el detalle de la planilla en formato PDF.
   * @returns
   */
  downloadReviewPdf(): void {
    if (!this.reviewSheetDetail) return;
    this.downloadPdf(this.mapDetailToResult(this.reviewSheetDetail));
  }

  /**
   * Confirma el envío de la planilla por un canal externo (por ejemplo, email o WhatsApp). Actualmente, esta función muestra un mensaje de advertencia indicando que la funcionalidad no está implementada, pero en el futuro se puede integrar con un endpoint del backend para realizar el envío real de la planilla a través del canal deseado.
   */
  confirmSend(): void {
    // TODO: integrar con endpoint de envío cuando esté disponible en el backend
    this.msg.add({
      severity: 'warn',
      summary: 'No disponible',
      detail: 'El envío por canal externo no está implementado aún.',
      life: 5000,
    });
  }

  /**
   * Mapea los detalles de una planilla a la estructura resultante.
   * @param detail
   * @returns
   */
  private mapDetailToResult(
    detail: CollectionSheetDetail,
  ): GeneratedPlanillaResult {
    const entries: PlanillaEntry[] = detail.items.map((item) => ({
      clientName: item.customerName,
      clientDni: 'N/D', // TODO: customer_dni not included in collection items — consider adding to backend
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
   * Mapea el estado de pago de una cuota al formato esperado en la planilla. Dado que el backend devuelve estados como "PENDING", "OVERDUE", "PARTIAL" o "PAID", esta función los convierte a sus equivalentes en español ("PENDIENTE", "EN_MORA", "PARCIAL", "COBRADO") para que se muestren correctamente en la planilla generada.
   * @param status
   * @returns
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

  /**
   * Obtiene la etiqueta para un filtro específico.
   * @param filter
   * @returns
   */
  filterLabel(filter: CollectionFilter): string {
    return COLLECTION_FILTER_LABELS[filter] ?? filter;
  }

  /**
   * Formatea una fecha en el formato dd/mm/yyyy.
   * @param iso
   * @returns
   */
  formatDate(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  }

  formatCurrency(value: number): string {
    return this.format.currency(value);
  }
}
