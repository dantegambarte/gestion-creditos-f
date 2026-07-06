import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, map, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../core/models/app-error';
import { DateService } from '../../../core/services/date.service';
import { FormatService } from '../../../core/services/format.service';
import { HeaderService } from '../../../core/services/header.service';
import { CollectionsService } from '../../collector/collections.service';
import {
  COLLECTION_FILTER_LABELS,
  CollectionFilter,
  CollectionGenerateResult,
  CollectionSheet,
  CollectionSheetDetail,
} from '../../collector/models/collection.model';
import {
  GeneratedPlanillaResult,
  PlanillaEntry,
} from '../models/interface/sheet';
import { UsersService } from '../users/users.service';
import { SheetHistoryComponent } from './sheet-history/sheet-history.component';
import { SheetReviewDialogComponent } from './sheet-review-dialog/sheet-review-dialog.component';

@Component({
  selector: 'app-sheet',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CalendarModule,
    CardModule,
    DropdownModule,
    ToastModule,
    SheetHistoryComponent,
    SheetReviewDialogComponent,
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
  private readonly dateSvc = inject(DateService);
  private destroy$ = new Subject<void>();

  collectorOptions: { label: string; value: string }[] = [];
  selectedCollectorId: string | null = null;

  selectedDate: string = '';
  // Trabajo Diario: filtro recomendado para el día a día (incluye todo lo
  // accionable hoy, mora incluida). Es el default para no dejar cuotas sin trabajar.
  selectedFilter: CollectionFilter = 'TODAY_AND_OVERDUE';
  filterOptions: { label: string; value: CollectionFilter }[] = [
    { label: 'Trabajo Diario (recomendado)', value: 'TODAY_AND_OVERDUE' },
    { label: 'Solo hoy', value: 'TODAY' },
    { label: 'Vencidas sin agenda', value: 'OVERDUE' },
    { label: 'Todas las pendientes', value: 'ALL_PENDING' },
  ];

  generating = false;
  generatingAll = false;
  results: GeneratedPlanillaResult[] = [];

  historial: CollectionSheet[] = [];
  loadingHistorial = true;

  showReviewDialog = false;
  selectedSheetId: string | null = null;

  ngOnInit(): void {
    this.selectedDate = this.dateSvc.toLocalIso(new Date());
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
   * Carga el historial de planillas generadas.
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
   * Genera una planilla para el cobrador seleccionado.
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
        finalize(() => {
          this.generating = false;
        }),
      )
      .subscribe({
        next: (result) => {
          this.results = [
            this.mapDetailToResult((result as CollectionGenerateResult).sheet),
            ...this.results,
          ];
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
                map((generated) => ({
                  success: true as const,
                  result: this.mapDetailToResult((generated as CollectionGenerateResult).sheet),
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
   * @param result datos de la planilla generada
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
   * Abre el dialog de revisión para la planilla indicada.
   * @param sheetId ID de la planilla
   */
  openReview(sheetId: string): void {
    this.selectedSheetId = sheetId;
    this.showReviewDialog = true;
  }

  /**
   * Descarga el PDF desde el evento emitido por el dialog de revisión.
   * @param detail detalle de la planilla cargada en el dialog
   */
  onDownloadFromDialog(detail: CollectionSheetDetail): void {
    this.downloadPdf(this.mapDetailToResult(detail));
  }

  /**
   * Marca la planilla indicada como enviada al cobrador.
   * @param sheetId ID de la planilla a enviar
   */
  confirmSend(sheetId: string): void {
    this.collectionsService
      .send(sheetId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.msg.add({
            severity: 'success',
            summary: 'Planilla enviada',
            detail: 'La planilla fue marcada como enviada correctamente.',
          });
          this.loadHistorial();
        },
        error: (err: AppError) => {
          this.msg.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary: err.status === 409 ? 'Aviso' : 'Error',
            detail:
              err.message ?? 'No se pudo marcar la planilla como enviada.',
          });
        },
      });
  }

  /**
   * Obtiene la etiqueta legible del filtro de cuotas.
   * @param filter clave del filtro
   */
  filterLabel(filter: CollectionFilter): string {
    return COLLECTION_FILTER_LABELS[filter] ?? filter;
  }

  /**
   * Formatea una fecha ISO al formato dd/mm/yyyy.
   * @param iso fecha en formato ISO
   */
  formatDate(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  }

  formatCurrency(value: number): string {
    return this.format.currency(value);
  }

  mapDetailToResult(detail: CollectionSheetDetail): GeneratedPlanillaResult {
    const entries: PlanillaEntry[] = detail.items.map((item) => ({
      clientName: item.customerName,
      clientDni: item.customerDni ?? 'N/D',
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
