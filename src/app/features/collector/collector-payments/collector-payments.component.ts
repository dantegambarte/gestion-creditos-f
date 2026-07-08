import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { AppError } from '../../../core/models/app-error';
import { HeaderService } from '../../../core/services/header.service';
import { ErrorStateComponent } from '../../../shared/states/error-state/error-state.component';
import { Payment, PaymentStatus } from '../models/payment.model';
import { PaymentsService } from '../payments.service';
import { FfBackTopFabComponent } from '../../../shared/components/back-top-fab/ff-back-top-fab.component';

@Component({
  selector: 'app-collector-payments',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    DatePipe,
    FormsModule,
    ButtonModule,
    CardModule,
    TableModule,
    TagModule,
    DropdownModule,
    SkeletonModule,
    TooltipModule,
    ErrorStateComponent,
    FfBackTopFabComponent,
  ],
  templateUrl: './collector-payments.component.html',
})
export class CollectorPaymentsComponent implements OnInit {
  private readonly paymentsService = inject(PaymentsService);
  private readonly header = inject(HeaderService);

  payments: Payment[] = [];
  loading = true;
  error: AppError | null = null;
  filterStatus: PaymentStatus | null = null;

  readonly STATUS_OPTIONS = [
    { label: 'Pendiente', value: 'PENDING' as PaymentStatus },
    { label: 'Aprobado', value: 'APPROVED' as PaymentStatus },
    { label: 'Rechazado', value: 'REJECTED' as PaymentStatus },
  ];

  /**
   * Devuelve la lista de pagos filtrada por estado, según el valor seleccionado en `filterStatus`. Si no hay ningún filtro aplicado (`filterStatus` es null), devuelve la lista completa de pagos. De lo contrario, devuelve solo aquellos pagos cuyo estado coincide con el filtro seleccionado.
   */
  get filteredPayments(): Payment[] {
    if (!this.filterStatus) return this.payments;
    return this.payments.filter((p) => p.status === this.filterStatus);
  }

  ngOnInit(): void {
    this.header.set([{ label: 'Mis cobros' }]);
    this.load();
  }

  /**
   * Devuelve la severidad del estado de un pago.
   * @param status
   * @returns
   */
  statusSeverity(
    status: PaymentStatus,
  ): 'success' | 'warning' | 'danger' | 'secondary' {
    const map: Record<
      PaymentStatus,
      'success' | 'warning' | 'danger' | 'secondary'
    > = {
      PENDING: 'warning',
      APPROVED: 'success',
      REJECTED: 'danger',
    };
    return map[status];
  }

  /**
   * Devuelve la etiqueta del estado de un pago.
   * @param status
   * @returns
   */
  statusLabel(status: PaymentStatus): string {
    const map: Record<PaymentStatus, string> = {
      PENDING: 'Pendiente',
      APPROVED: 'Aprobado',
      REJECTED: 'Rechazado',
    };
    return map[status];
  }

  /**
   * Refresca la lista de pagos volviendo a cargar los datos desde el servidor. Esta función se puede llamar, por ejemplo, después de aprobar o rechazar un pago para asegurarse de que la lista muestre la información más actualizada.
   */
  refresh(): void {
    this.load();
  }

  /**
   * Carga la lista de pagos desde el servidor utilizando el servicio `PaymentsService`. Actualiza las propiedades `payments`, `loading` y `error` según corresponda para reflejar el estado de la carga. En caso de éxito, se asignan los datos recibidos a la propiedad `payments` y se establece `loading` en false. En caso de error, se asigna el error a la propiedad `error` y también se establece `loading` en false para indicar que la carga ha finalizado, aunque con un error.
   */
  private load(): void {
    this.loading = true;
    this.error = null;
    this.paymentsService.list().subscribe({
      next: (data) => {
        this.payments = data;
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }
}
