import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AppError } from '../../../core/models/app-error';
import { DateService } from '../../../core/services/date.service';
import { HeaderService } from '../../../core/services/header.service';
import { ErrorStateComponent } from '../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/states/loading-state/loading-state.component';
import { CollectionsService } from '../collections.service';
import {
  COLLECTION_FILTER_LABELS,
  CollectionFilter,
  CollectionSheet,
} from '../models/collection.model';
import { Payment } from '../models/payment.model';
import { PaymentsService } from '../payments.service';
import { FfBackTopFabComponent } from '../../../shared/components/back-top-fab/ff-back-top-fab.component';

@Component({
  selector: 'app-route',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    DatePipe,
    ButtonModule,
    CardModule,
    TableModule,
    TagModule,
    SkeletonModule,
    LoadingStateComponent,
    ErrorStateComponent,
    FfBackTopFabComponent,
  ],
  templateUrl: './route.component.html',
  styleUrl: './route.component.scss',
})
export class RouteComponent implements OnInit {
  private readonly collectionsService = inject(CollectionsService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly router = inject(Router);
  private readonly header = inject(HeaderService);
  private readonly dateSvc = inject(DateService);

  sheets: CollectionSheet[] = [];
  recentPayments: Payment[] = [];
  loadingSheets = true;
  loadingPayments = true;
  errorSheets: AppError | null = null;
  // Arranca expandida: con una sola planilla del día, el cobrador la ve directo
  // sin tener que desplegar la tarjeta.
  sheetsExpanded = true;
  recentPaymentsExpanded = false;

  today = new Date();

  private get todayIso(): string {
    return this.dateSvc.toLocalIso(new Date());
  }

  /**
   * Planilla actual del cobrador = la ÚLTIMA generada (mayor created_at). Es la
   * única que se muestra en Mi Ruta; las anteriores quedan en el historial del
   * admin pero no se listan acá. null si el cobrador no tiene planillas.
   */
  get currentSheet(): CollectionSheet | null {
    if (!this.sheets.length) return null;
    return this.sheets.reduce(
      (latest, s) => (s.createdAt > latest.createdAt ? s : latest),
      this.sheets[0],
    );
  }

  /** La planilla actual como lista (0 o 1) para reutilizar la tabla/cards existentes. */
  get currentSheetList(): CollectionSheet[] {
    const sheet = this.currentSheet;
    return sheet ? [sheet] : [];
  }

  /**
   * Fecha de la planilla actual. Ancla el resumen de recaudación a esa planilla:
   * al generarse una planilla de otro día, la recaudación cambia sola.
   */
  get currentSheetDate(): string | null {
    return this.currentSheet?.sheetDate ?? null;
  }

  /**
   * Recaudación de la planilla actual: total, efectivo y transferencia. Suma los
   * cobros del DÍA de esa planilla (PENDING + APPROVED, sin reversiones), sin
   * mezclar otros días. Se reinicia solo cuando la planilla actual es de otro día.
   */
  get dailyCollection(): { total: number; cash: number; transfer: number } {
    const date = this.currentSheetDate;
    if (!date) return { total: 0, cash: 0, transfer: 0 };
    let cash = 0;
    let transfer = 0;
    for (const p of this.recentPayments) {
      if (p.isReversal) continue;
      // Un cobro aprobado y luego revertido queda en APPROVED, pero con
      // reversalPaymentId seteado: no debe sumar (el dinero se devolvió). El
      // rechazo de una pre-carga ya queda cubierto por el filtro de status.
      if (p.reversalPaymentId) continue;
      if (p.status !== 'PENDING' && p.status !== 'APPROVED') continue;
      if (this.dateSvc.toLocalIso(new Date(p.createdAt)) !== date) continue;
      cash += p.amountCash;
      transfer += p.amountTransfer;
    }
    return { total: cash + transfer, cash, transfer };
  }

  ngOnInit(): void {
    this.header.set([{ label: 'Mi Ruta' }]);
    this.loadSheets();
    this.loadRecentPayments();
  }

  /**
   * Obtiene la etiqueta correspondiente a un filtro de colección.
   * @param f
   * @returns
   */
  filterLabel(f: CollectionFilter): string {
    return COLLECTION_FILTER_LABELS[f];
  }

  /**
   * Indica si la fecha de planilla coincide con el día actual.
   * @param sheetDate Fecha de planilla en formato ISO corto (yyyy-mm-dd).
   * @returns `true` cuando la planilla es de hoy.
   */
  isTodaySheet(sheetDate: string): boolean {
    return sheetDate === this.todayIso;
  }

  /**
   * Construye la etiqueta breve del método de pago para la lista lateral.
   * @param method Método de pago guardado en el cobro.
   * @returns Texto corto para mostrar en UI.
   */
  paymentMethodLabel(method: Payment['paymentMethod']): string {
    if (method === 'CASH') return 'Efectivo';
    if (method === 'TRANSFER') return 'Transferencia';
    return 'Mixto';
  }

  /**
   * Traduce el estado del cobro a una etiqueta amigable para la UI.
   * @param status Estado técnico devuelto por backend.
   * @returns Estado legible para el usuario.
   */
  paymentStatusLabel(status: Payment['status']): string {
    if (status === 'APPROVED') return 'Aprobado';
    if (status === 'REJECTED') return 'Rechazado';
    return 'Pendiente';
  }

  /**
   * Navega a la vista de una planilla específica.
   * @param sheet
   */
  goToSheet(sheet: CollectionSheet): void {
    this.router.navigate(['/collector/route', sheet.id]);
  }

  /**
   * Navega al listado completo de cobros del cobrador.
   */
  goToPayments(): void {
    this.router.navigate(['/collector/payments']);
  }

  /** Alterna la visibilidad de la sección de planillas asignadas. */
  toggleSheets(): void {
    this.sheetsExpanded = !this.sheetsExpanded;
  }

  /** Expande planillas al tocar la tarjeta cerrada sin contraerla por accidente. */
  expandSheets(): void {
    if (!this.sheetsExpanded) this.sheetsExpanded = true;
  }

  /** Alterna la visibilidad de la sección de cobros recientes. */
  toggleRecentPayments(): void {
    this.recentPaymentsExpanded = !this.recentPaymentsExpanded;
  }

  /** Expande cobros recientes al tocar la tarjeta cerrada sin contraerla por accidente. */
  expandRecentPayments(): void {
    if (!this.recentPaymentsExpanded) this.recentPaymentsExpanded = true;
  }

  /**
   * Carga la lista de planillas.
   */
  private loadSheets(): void {
    this.loadingSheets = true;
    this.collectionsService.list().subscribe({
      next: (data) => {
        this.sheets = data;
        this.loadingSheets = false;
      },
      error: (err: AppError) => {
        this.errorSheets = err;
        this.loadingSheets = false;
      },
    });
  }

  /**
   * Carga los pagos recientes.
   */
  private loadRecentPayments(): void {
    this.loadingPayments = true;
    this.paymentsService.list().subscribe({
      next: (data) => {
        this.recentPayments = data;
        this.loadingPayments = false;
      },
      error: () => {
        this.loadingPayments = false;
      },
    });
  }
}
