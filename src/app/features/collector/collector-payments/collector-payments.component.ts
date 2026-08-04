import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { AppError } from '../../../core/models/app-error';
import { DateService } from '../../../core/services/date.service';
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
    CalendarModule,
    DropdownModule,
    InputTextModule,
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
  private readonly dateSvc = inject(DateService);

  payments: Payment[] = [];
  loading = true;
  error: AppError | null = null;
  filterStatus: PaymentStatus | null = null;
  /** Día seleccionado para filtrar por fecha del cobro (null = sin filtro). */
  filterDate: Date | null = null;
  searchTerm = '';

  /** Hoy, como tope del calendario: no hay cobros con fecha futura. */
  readonly today: Date = this.dateSvc.startOfToday();

  readonly STATUS_OPTIONS = [
    { label: 'Pendiente', value: 'PENDING' as PaymentStatus },
    { label: 'Aprobado', value: 'APPROVED' as PaymentStatus },
    { label: 'Rechazado', value: 'REJECTED' as PaymentStatus },
  ];

  /**
   * Devuelve la lista de pagos filtrada por estado, texto libre y fecha. Los tres
   * filtros se combinan (AND): un pago debe cumplir todos los que estén activos.
   */
  get filteredPayments(): Payment[] {
    const query = this.searchTerm.trim().toLowerCase();
    const dateIso = this.filterDate
      ? this.dateSvc.toLocalIso(this.filterDate)
      : null;
    return this.payments.filter((p) => {
      const matchesStatus = !this.filterStatus || p.status === this.filterStatus;
      const matchesSearch = !query || this.paymentMatchesSearch(p, query);
      const matchesDate =
        !dateIso || this.dateSvc.toLocalIso(new Date(p.createdAt)) === dateIso;
      return matchesStatus && matchesSearch && matchesDate;
    });
  }

  /** True si hay algún filtro activo (para el mensaje de lista vacía). */
  get hasActiveFilters(): boolean {
    return !!this.searchTerm.trim() || !!this.filterStatus || !!this.filterDate;
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
   * Limpia el texto de búsqueda para volver a mostrar los cobros del estado seleccionado.
   */
  clearSearch(): void {
    this.searchTerm = '';
  }

  /**
   * Indica si un cobro coincide con el texto ingresado por el usuario.
   */
  private paymentMatchesSearch(payment: Payment, query: string): boolean {
    const values = [
      payment.customerName,
      payment.customerDni,
      `cuota ${payment.installmentNumber}`,
      String(payment.installmentNumber),
      String(payment.amountReceived),
      this.statusLabel(payment.status),
      this.paymentMethodLabel(payment.paymentMethod),
      payment.createdAt,
    ];

    return values.some((value) => value.toLowerCase().includes(query));
  }

  /**
   * Devuelve la etiqueta del método de pago de un cobro.
   */
  paymentMethodLabel(method: Payment['paymentMethod']): string {
    const map: Record<Payment['paymentMethod'], string> = {
      CASH: 'Efectivo',
      TRANSFER: 'Transferencia',
      MIXED: 'Mixto',
    };
    return map[method];
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
