import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
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
import { CommissionsService } from '../../admin/commissions/commissions.service';
import {
  Commission,
  CommissionStatus,
  Liquidation,
} from '../../admin/models/commission.model';

@Component({
  selector: 'app-seller-commissions',
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
  ],
  providers: [MessageService],
  templateUrl: './seller-commissions.component.html',
})
export class SellerCommissionsComponent implements OnInit, OnDestroy {
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
   * Carga la lista de comisiones aplicando el filtro de estado seleccionado (si lo hay).
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
   * Carga el historial de liquidaciones del vendedor. Durante la carga, se muestra un indicador de carga y se maneja cualquier error que pueda ocurrir durante la solicitud. Al finalizar la carga, se actualiza la lista de liquidaciones con los datos obtenidos del servicio.
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
   * Maneja el cambio en el filtro de estado de las comisiones. Cada vez que el usuario selecciona un nuevo estado para filtrar las comisiones (por ejemplo, "Pendiente" o "Pagada"), esta función se ejecuta y recarga la lista de comisiones aplicando el nuevo filtro seleccionado. Esto permite al usuario ver solo las comisiones que corresponden al estado elegido.
   */
  onFilterChange(): void {
    this.loadCommissions();
  }

  /**
   * Obtiene la severidad correspondiente a un estado de comisión.
   * @param status
   * @returns
   */
  statusSeverity(status: CommissionStatus): 'warning' | 'success' {
    return status === 'PENDING' ? 'warning' : 'success';
  }

  /**
   * Obtiene la etiqueta correspondiente a un estado de comisión.
   * @param status
   * @returns
   */
  statusLabel(status: CommissionStatus): string {
    return status === 'PENDING' ? 'Pendiente' : 'Pagada';
  }

  /**
   * Obtiene la etiqueta correspondiente a un tipo de crédito.
   * @param type
   * @returns
   */
  creditTypeLabel(type: string): string {
    return type === 'SALE' ? 'Venta' : 'Préstamo';
  }

  /**
   * Obtiene la etiqueta correspondiente a un método de pago.
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
   * Formatea una fecha en formato ISO a un string legible.
   * @param iso
   * @returns
   */
  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = iso.split('T')[0].split('-');
    return `${d[2]}/${d[1]}/${d[0]}`;
  }
}
