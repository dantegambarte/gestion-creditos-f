import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, combineLatest } from 'rxjs';
import { catchError, of, takeUntil } from 'rxjs';
import { Credit } from '../../../../seller/models/credit.model';
import { CreditsService } from '../../../../seller/operations/credits.service';
import { PaymentsService } from '../../../../collector/payments.service';
import { Payment, PendingCreditGroup, PendingPaymentGroup } from '../../../models/interface/dashboard';

@Component({
  selector: 'app-dashboard-pending',
  standalone: true,
  imports: [CurrencyArsPipe, SkeletonModule],
  templateUrl: './dashboard-pending.component.html',
})
export class DashboardPendingComponent implements OnInit, OnDestroy, OnChanges {
  /** Si la caja está cerrada, deshabilita aprobar/revisar. */
  @Input() isCashClosed = false;
  /** Emite cuando debe mostrarse o limpiarse una alerta en la página. */
  @Output() alertUpdated = new EventEmitter<{
    show: boolean;
    message: string;
  }>();
  /** Emite tras aprobar un cobro para que el padre recargue KPIs y gráficos. */
  @Output() paymentApproved = new EventEmitter<void>();

  loadingPending = true;
  pendingCredits: PendingCreditGroup[] = [];
  pendingPayments: PendingPaymentGroup[] = [];

  private readonly router = inject(Router);
  private readonly creditsSvc = inject(CreditsService);
  private readonly paymentsSvc = inject(PaymentsService);
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadPending();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isCashClosed']) {
      // Limpiar alerta de caja si el estado cambia
      this.alertUpdated.emit({ show: false, message: '' });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga los créditos y cobros pendientes, agrupados por vendedor/cobrador.
   * También verifica si hay cobros pendientes con más de 48 horas sin aprobar.
   */
  loadPending(): void {
    this.loadingPending = true;

    combineLatest([
      this.creditsSvc
        .list({ status: 'PENDING_APPROVAL' })
        .pipe(catchError(() => of([]))),
      this.paymentsSvc
        .list({ status: 'PENDING' })
        .pipe(catchError(() => of([]))),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([credits, payments]) => {
        this.pendingCredits = this.groupCreditsBySeller(credits);
        this.pendingPayments = this.groupPaymentsByCollector(payments);
        this.checkPendingAlerts(payments);
        this.loadingPending = false;
      });
  }

  /**
   * Retorna el total de créditos pendientes sumando el count de cada grupo.
   */
  getTotalCredits(): number {
    return this.pendingCredits.reduce((sum, group) => sum + group.count, 0);
  }

  /**
   * Retorna el total de cobros pendientes sumando el count de cada grupo.
   */
  getTotalPayments(): number {
    return this.pendingPayments.reduce((sum, group) => sum + group.count, 0);
  }

  /**
   * Calcula tiempo transcurrido desde una fecha en formato legible.
   * @param dateStr fecha ISO
   */
  timeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);

    if (diffDays > 0) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    if (diffHours > 0) return `hace ${diffHours}h`;
    return 'hace poco';
  }

  /**
   * Navega a la vista de aprobación de un crédito. Valida que la caja no esté cerrada.
   * @param creditId id del crédito
   */
  reviewCredit(creditId: string): void {
    if (this.isCashClosed) {
      this.alertUpdated.emit({
        show: true,
        message: 'No puedes aprobar créditos. La caja del día está CERRADA.',
      });
      return;
    }
    this.router.navigate(['/admin/operations', creditId]);
  }

  /**
   * Aprueba un cobro pendiente y recarga los datos. Valida que la caja no esté cerrada.
   * @param paymentId id del cobro
   */
  approvePayment(paymentId: string): void {
    if (this.isCashClosed) {
      this.alertUpdated.emit({
        show: true,
        message: 'No puedes aprobar pagos. La caja del día está CERRADA.',
      });
      return;
    }

    this.paymentsSvc
      .approve(paymentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadPending();
          this.paymentApproved.emit();
        },
        error: (err) => {
          console.error('Error al aprobar pago:', err);
          this.alertUpdated.emit({
            show: true,
            message: 'Error al aprobar el cobro. Intenta nuevamente.',
          });
        },
      });
  }

  private checkPendingAlerts(payments: { createdAt: string }[]): void {
    const now = new Date();
    const overdue48h = payments.filter((payment) => {
      if (!payment.createdAt) return false;
      const diffHours =
        (now.getTime() - new Date(payment.createdAt).getTime()) /
        (1000 * 60 * 60);
      return diffHours > 48;
    });

    if (overdue48h.length > 0) {
      const count = overdue48h.length;
      this.alertUpdated.emit({
        show: true,
        message: `${count} cobro${count > 1 ? 's' : ''} pendiente${count > 1 ? 's' : ''} con más de 48 horas sin revisar. Revisión recomendada.`,
      });
    } else {
      this.alertUpdated.emit({ show: false, message: '' });
    }
  }

  private groupCreditsBySeller(credits: Credit[]): PendingCreditGroup[] {
    const grouped = new Map<string | null, Credit[]>();

    credits.forEach((credit) => {
      const seller = credit.createdByName ?? 'Sin asignar';
      if (!grouped.has(seller)) grouped.set(seller, []);
      grouped.get(seller)!.push(credit);
    });

    return Array.from(grouped.entries()).map(([sellerName, items]) => {
      const sortedItems = items.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      return {
        sellerName,
        count: sortedItems.length,
        totalAmount: sortedItems.reduce((sum, c) => sum + c.totalAmount, 0),
        oldestDate: sortedItems.reduce(
          (oldest, c) =>
            new Date(c.createdAt) < new Date(oldest) ? c.createdAt : oldest,
          sortedItems[0].createdAt,
        ),
        credits: sortedItems,
      };
    });
  }

  private groupPaymentsByCollector(payments: Payment[]): PendingPaymentGroup[] {
    const grouped = new Map<string | null, Payment[]>();

    payments.forEach((payment) => {
      const collector = payment.collectorName ?? 'Sin asignar';
      if (!grouped.has(collector)) grouped.set(collector, []);
      grouped.get(collector)!.push(payment);
    });

    return Array.from(grouped.entries()).map(([collectorName, items]) => {
      const sortedItems = items.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      return {
        collectorName,
        count: sortedItems.length,
        totalAmount: sortedItems.reduce((sum, p) => sum + p.amountReceived, 0),
        oldestDate: sortedItems.reduce(
          (oldest, p) =>
            new Date(p.createdAt) < new Date(oldest) ? p.createdAt : oldest,
          sortedItems[0].createdAt,
        ),
        payments: sortedItems,
      };
    });
  }
}
