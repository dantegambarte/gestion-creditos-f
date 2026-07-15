import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { DedupMessageService } from '../../../core/services/dedup-message.service';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../core/models/app-error';
import { FormatService } from '../../../core/services/format.service';
import { HeaderService } from '../../../core/services/header.service';
import { ErrorStateComponent } from '../../../shared/states/error-state/error-state.component';
import {
  Commission,
  CommissionStatus,
  Liquidation,
} from '../../admin/models/commission.model';
import { CommissionsService } from '../../admin/commissions/commissions.service';
import { FfBackTopFabComponent } from '../../../shared/components/back-top-fab/ff-back-top-fab.component';

@Component({
  selector: 'app-collector-commissions',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CardModule,
    DropdownModule,
    SkeletonModule,
    TableModule,
    TagModule,
    ToastModule,
    ErrorStateComponent,
    FfBackTopFabComponent,
  ],
  providers: [{ provide: MessageService, useClass: DedupMessageService }],
  templateUrl: './collector-commissions.component.html',
})
export class CollectorCommissionsComponent implements OnInit, OnDestroy {
  private readonly service = inject(CommissionsService);
  private readonly header = inject(HeaderService);
  private destroy$ = new Subject<void>();
  readonly format = inject(FormatService);

  commissions: Commission[] = [];
  loading = true;
  error: AppError | null = null;

  liquidations: Liquidation[] = [];
  loadingLiquidations = true;

  filterStatus: CommissionStatus | null = null;

  readonly statusOptions = [
    { label: 'Pendiente', value: 'PENDING' as CommissionStatus },
    { label: 'Pagada', value: 'PAID' as CommissionStatus },
  ];

  ngOnInit(): void {
    this.header.set([{ label: 'Mis comisiones' }]);
    this.loadCommissions();
    this.loadLiquidations();
  }

  ngOnDestroy(): void {
    this.header.reset();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga las comisiones del cobrador, aplicando un filtro de estado si `filterStatus` tiene un valor. Actualiza las propiedades `commissions`, `loading` y `error` según corresponda.
   */
  loadCommissions(): void {
    this.loading = true;
    this.error = null;
    const filters = this.filterStatus
      ? { status: this.filterStatus }
      : undefined;
    this.service
      .getCommissions(filters)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (c) => {
          this.commissions = c;
        },
        error: (err: AppError) => {
          this.error = err;
        },
      });
  }

  /**
   * Carga el historial de liquidaciones del cobrador, actualizando las propiedades `liquidations` y `loadingLiquidations` según corresponda. Utiliza el método `getLiquidations` del servicio de comisiones para obtener los datos, y maneja la finalización de la carga con el operador `finalize` para asegurarse de que el indicador de carga se actualice correctamente tanto en casos de éxito como de error.
   */
  loadLiquidations(): void {
    this.loadingLiquidations = true;
    this.service
      .getLiquidations()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingLiquidations = false;
        }),
      )
      .subscribe({
        next: (l) => {
          this.liquidations = l;
        },
        error: () => {
          this.loadingLiquidations = false;
        },
      });
  }

  /**
   * Maneja el cambio en el filtro de estado de las comisiones.
   */
  onFilterChange(): void {
    this.loadCommissions();
  }

  /**
   * Devuelve el severidad del estado de una comisión.
   * @param status
   * @returns
   */
  statusSeverity(status: CommissionStatus): 'warning' | 'success' {
    return status === 'PENDING' ? 'warning' : 'success';
  }

  /**
   * Devuelve la etiqueta del estado de una comisión.
   * @param status
   * @returns
   */
  statusLabel(status: CommissionStatus): string {
    return status === 'PENDING' ? 'Pendiente' : 'Pagada';
  }

  /**
   * Devuelve la etiqueta del tipo de crédito.
   * @param type
   * @returns
   */
  creditTypeLabel(type: string): string {
    return type === 'SALE' ? 'Venta' : 'Préstamo';
  }

  /**
   * Devuelve la etiqueta del método de pago.
   * @param pm
   * @returns
   */
  paymentMethodLabel(pm: string): string {
    return pm === 'CASH' ? 'Efectivo' : 'Transferencia';
  }

  formatCurrency(value: number): string {
    return this.format.currency(value);
  }

  /**
   * Formatea una fecha en el formato dd/mm/yyyy.
   * @param iso
   * @returns
   */
  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = iso.split('T')[0].split('-');
    return `${d[2]}/${d[1]}/${d[0]}`;
  }
}
