import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Subject, catchError, combineLatest, of, takeUntil } from 'rxjs';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { DateService } from '../../../core/services/date.service';
import { FormatService } from '../../../core/services/format.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { KpiCard } from '../models/interface/kpi-card';
import { ReportsService } from '../reports/reports.service';
import { DashboardChartsComponent } from './dashboard-charts/dashboard-charts.component';
import { DashboardPendingComponent } from './dashboard-pending/dashboard-pending.component';

/**
 * Fila de la tabla de morosos del dashboard. Deriva del reporte de mora
 * (getOverdueReport), agrupado por cliente, para usar EXACTAMENTE la misma
 * definición de "en mora" que el KPI (IS_OVERDUE_DERIVED), y no el status
 * persistido de las cuotas.
 */
interface OverdueRow {
  id: string;
  customerName: string;
  daysOverdue: number;
  overdueCount: number;
  amountDue: number;
  amountPaid: number;
  status: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyArsPipe,
    DatePipe,
    MessageModule,
    TableModule,
    TagModule,
    SkeletonModule,
    DashboardPendingComponent,
    DashboardChartsComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthServiceBase);
  private readonly reportsSvc = inject(ReportsService);
  private readonly cashRegisterSvc = inject(CashRegisterService);
  private readonly dateService = inject(DateService);
  private readonly fmt = inject(FormatService);

  userName = '';
  today = '';
  loadingKpis = true;
  loadingUpcoming = true;
  isCashClosed = false;
  showAlert = false;
  alertMessage = '';
  kpis: KpiCard[] = [];
  upcomingInstallments: OverdueRow[] = [];
  upcomingError = false;

  /** Datos diarios del mes pasados al componente de gráficos cuando los KPIs terminan de cargar. */
  monthlyDailyData: { day: string; total: number }[] | null = null;

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.userName = this.auth.snapshot?.name ?? 'Administrador';
    this.today = this.dateService.display(new Date(), "EEEE d 'de' MMMM, yyyy");
    this.checkCashRegisterStatus();
    this.loadKpis();
    this.loadUpcomingInstallments();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Verifica si hay una caja operativa abierta en la jornada actual (V4).
   * Es la condición real que el backend exige para aprobar cobros; el flag
   * legacy de cash_registers (is_closed) ya no se puebla y daba siempre false.
   */
  private checkCashRegisterStatus(): void {
    this.cashRegisterSvc
      .getActiveSession()
      .pipe(
        catchError(() => of(null)),
        takeUntil(this.destroy$),
      )
      .subscribe((session) => {
        this.isCashClosed = !session;
      });
  }

  /**
   * Carga los KPIs del dashboard y el reporte mensual.
   * Al completar, actualiza monthlyDailyData para que el componente de gráficos se renderice.
   */
  loadKpis(): void {
    this.loadingKpis = true;

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const dateFromMonth = this.dateService.toLocalIso(firstDay);
    const dateToMonth = this.dateService.toLocalIso(today);

    combineLatest([
      this.reportsSvc.getSummaryReport().pipe(catchError(() => of(null))),
      this.reportsSvc
        .getCollectionReport({ dateFrom: dateFromMonth, dateTo: dateToMonth })
        .pipe(catchError(() => of(null))),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([summary, monthlyCollection]) => {
        if (!summary) {
          this.kpis = [];
          this.loadingKpis = false;
          return;
        }

        const overduePercent =
          summary.activePortfolioBalance > 0
            ? (summary.overdueAmount / summary.activePortfolioBalance) * 100
            : 0;
        const pendingTotal =
          summary.pendingCreditsCount + summary.pendingPaymentsCount;
        const monthlyTotal = monthlyCollection?.summary?.grandTotal ?? 0;

        this.kpis = [
          {
            label: 'Recaudación de la jornada',
            value: this.fmt.currency(summary.todayTotal),
            subtitle: `${this.fmt.currency(summary.todayCash)} efec. · ${this.fmt.currency(summary.todayTransfer)} transf.`,
            trend: `${summary.todayPaymentsCount} cobros`,
            trendUp: true,
            icon: 'pi pi-wallet',
            iconBg: 'db-kpi__bg--accent',
          },
          {
            label: 'Créditos activos',
            value: this.fmt.number(summary.activeCreditsCount),
            subtitle: `${this.fmt.currency(summary.activePortfolioBalance)} cartera`,
            trend: 'Saldo de cartera',
            trendUp: true,
            icon: 'pi pi-box',
            iconBg: 'db-kpi__bg--success',
          },
          {
            label: 'En mora',
            value: this.fmt.number(summary.overdueCount),
            subtitle: `${this.fmt.currency(summary.overdueAmount)} · ${overduePercent.toFixed(1)}% de cartera`,
            trend: overduePercent > 10 ? 'Alerta' : 'Normal',
            trendUp: overduePercent <= 10,
            icon: 'pi pi-exclamation-triangle',
            iconBg:
              overduePercent > 10
                ? 'db-kpi__bg--danger'
                : 'db-kpi__bg--warning',
          },
          {
            label: 'Pendientes de autorizar',
            value: this.fmt.number(pendingTotal),
            subtitle: `${summary.pendingCreditsCount} créditos · ${summary.pendingPaymentsCount} cobros`,
            trend: pendingTotal > 0 ? 'Requiere atención' : 'Al día',
            trendUp: pendingTotal === 0,
            icon: 'pi pi-file',
            iconBg: 'db-kpi__bg--info',
          },
          {
            label: 'Recaudado del mes',
            value: this.fmt.currency(monthlyTotal),
            subtitle: 'Progreso del mes',
            trend: `${monthlyTotal > 0 ? 'Activo' : 'Sin movimientos'}`,
            trendUp: true,
            icon: 'pi pi-chart-bar',
            iconBg: 'db-kpi__bg--success',
          },
          {
            label: 'Refinanciados',
            value: this.fmt.number(summary.refinancedMonthCount),
            subtitle: `${this.fmt.currency(summary.refinancedMonthAmount)} refinanciados`,
            trend: 'Este mes',
            trendUp: true,
            icon: 'pi pi-refresh',
            iconBg: 'db-kpi__bg--mint',
          },
        ];

        this.loadingKpis = false;
        // Notifica al componente de gráficos que ya tiene datos para renderizarse
        this.monthlyDailyData = monthlyCollection?.daily ?? [];
      });
  }

  /**
   * Traduce el estado de una cuota al español.
   * @param status estado de la cuota
   */
  statusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'Pendiente',
      OVERDUE: 'Vencido',
    };
    return map[status] ?? status;
  }

  /**
   * Carga los clientes en mora (top 5 por monto) desde el reporte de mora, que
   * usa la MISMA definición derivada (IS_OVERDUE_DERIVED con días de gracia) que
   * el KPI "En mora". Antes se usaba installments.list({status:'OVERDUE'}) — el
   * status persistido —, lo que podía contradecir al KPI. Ahora ambos comparten
   * la única fuente de verdad.
   */
  private loadUpcomingInstallments(): void {
    this.loadingUpcoming = true;
    this.upcomingError = false;
    this.reportsSvc
      .getOverdueReport()
      .pipe(
        catchError(() => of(null)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (report) => {
          if (!report) {
            this.upcomingError = true;
            this.upcomingInstallments = [];
            this.loadingUpcoming = false;
            return;
          }
          // byCustomer ya viene ordenado por monto de mora descendente.
          this.upcomingInstallments = report.byCustomer.slice(0, 5).map((c) => ({
            id: c.customerId,
            customerName: c.customerName,
            daysOverdue: c.maxDaysOverdue,
            overdueCount: c.overdueCount,
            amountDue: c.totalOverdue,
            amountPaid: 0,
            status: 'OVERDUE',
          }));
          this.loadingUpcoming = false;
        },
        error: () => {
          this.upcomingError = true;
          this.loadingUpcoming = false;
        },
      });
  }

  /**
   * Recibe alertas del componente de pendientes y las muestra en el banner de la página.
   * @param alert objeto con show y message
   */
  onAlertUpdated(alert: { show: boolean; message: string }): void {
    this.showAlert = alert.show;
    this.alertMessage = alert.message;
  }

  /**
   * Recarga KPIs tras la aprobación de un cobro en el componente de pendientes.
   * La actualización de monthlyDailyData dispara automáticamente la recarga de gráficos.
   */
  onPaymentApproved(): void {
    this.loadKpis();
  }

  navigateNewCredit(): void {
    this.router.navigate(['/admin/operations/new']);
  }

  navigateCashRegister(): void {
    this.router.navigate(['/admin/cash-register']);
  }

  navigateGenerateSheet(): void {
    this.router.navigate(['/admin/collections'], {
      queryParams: { openGenerate: 'true' },
    });
  }

  navigateReports(): void {
    this.router.navigate(['/admin/reports']);
  }
}
