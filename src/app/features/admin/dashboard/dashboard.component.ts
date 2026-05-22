import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Subject } from 'rxjs';
import { catchError, combineLatest, of, take, takeUntil } from 'rxjs';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { DateService } from '../../../core/services/date.service';
import { FormatService } from '../../../core/services/format.service';
import { KpiCard } from '../models/interface/kpi-card';
import { ReportsService } from '../reports/reports.service';
import { PaymentsService } from '../../collector/payments.service';
import { CreditsService } from '../../seller/operations/credits.service';
import { InstallmentsService } from '../../seller/operations/installments.service';
import { Installment } from '../../seller/models/installment.model';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { MONTH_LIST } from '../utils/month-list';
import { STATUS_CLIENT } from '../utils/status-client';
import { Credit } from '../../seller/models/credit.model';

interface PendingCreditGroup {
  sellerName: string | null;
  count: number;
  totalAmount: number;
  oldestDate: string;
  credits: Credit[];
}

interface PendingPaymentGroup {
  collectorName: string | null;
  count: number;
  totalAmount: number;
  oldestDate: string;
  payments: Payment[];
}

interface Payment {
  id: string;
  amountReceived: number;
  paymentMethod: string;
  createdAt: string;
  installmentNumber?: number;
  amountDue?: number;
  customerName?: string;
  collectorName?: string | null;
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
    CardModule,
    ChartModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthServiceBase);
  private readonly reportsSvc = inject(ReportsService);
  private readonly paymentsSvc = inject(PaymentsService);
  private readonly creditsSvc = inject(CreditsService);
  private readonly installmentsSvc = inject(InstallmentsService);
  private readonly cashRegisterSvc = inject(CashRegisterService);
  private readonly dateService = inject(DateService);
  private readonly fmt = inject(FormatService);
  private readonly cdr = inject(ChangeDetectorRef);

  userName = '';
  today = '';
  loadingKpis = true;
  loadingUpcoming = true;
  loadingPending = true;
  loadingCharts = true;
  isCashClosed = false;
  kpis: KpiCard[] = [];
  upcomingInstallments: (Installment & { daysOverdue: number })[] = [];
  upcomingError = false;
  showAlert = false;
  alertMessage = '';
  pendingCredits: PendingCreditGroup[] = [];
  pendingPayments: PendingPaymentGroup[] = [];

  // Reporte mensual reutilizado
  monthlyCollectionReport: any = null;

  // Charts
  chartWeeklyData: any;
  chartWeeklyOptions: any;
  chartCollectorsData: any = { labels: [], datasets: [] };
  chartCollectorsOptions: any;
  chartSellersData: any = { labels: [], datasets: [] };
  chartSellersOptions: any;

  lineData: any;
  lineOptions: any;
  pieData: any;
  pieOptions: any;

  private destroy$ = new Subject<void>();
  private monthlyReportReady$ = new Subject<void>();

  ngOnInit(): void {
    this.userName = this.auth.snapshot?.name ?? 'Administrador';
    this.today = this.dateService.display(new Date(), "EEEE d 'de' MMMM, yyyy");
    this.checkCashRegisterStatus();
    this.loadKpis();
    this.loadUpcomingInstallments();
    this.loadPending();
    this.initCharts();
    this.loadCharts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Verifica el estado de cierre de caja del día actual.
   */
  private checkCashRegisterStatus(): void {
    this.cashRegisterSvc
      .getDashboard()
      .pipe(
        catchError(() => of(null)),
        takeUntil(this.destroy$),
      )
      .subscribe((dashboard) => {
        this.isCashClosed = dashboard?.isClosed ?? false;
      });
  }

  /**
   * Carga los datos para las tarjetas KPI, obteniendo un resumen de los indicadores clave del sistema a través del servicio de reportes. También carga la recaudación del mes en paralelo.
   */
  private loadKpis(): void {
    this.loadingKpis = true;

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const dateFromMonth = firstDay.toISOString().split('T')[0];
    const dateToMonth = today.toISOString().split('T')[0];

    combineLatest([
      this.reportsSvc.getSummaryReport().pipe(catchError(() => of(null))),
      this.reportsSvc.getCollectionReport({ dateFrom: dateFromMonth, dateTo: dateToMonth }).pipe(catchError(() => of(null))),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([summary, monthlyCollection]) => {
        if (!summary) {
          this.kpis = [];
          this.loadingKpis = false;
          return;
        }

        // Guardar el reporte mensual para reutilizarlo en loadCharts()
        this.monthlyCollectionReport = monthlyCollection;

        const overduePercent = summary.activePortfolioBalance > 0
          ? (summary.overdueAmount / summary.activePortfolioBalance) * 100
          : 0;
        const pendingTotal = summary.pendingCreditsCount + summary.pendingPaymentsCount;
        const monthlyTotal = monthlyCollection?.summary?.grandTotal ?? 0;

        this.kpis = [
          {
            label: 'Recaudado hoy',
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
            iconBg: overduePercent > 10 ? 'db-kpi__bg--danger' : 'db-kpi__bg--warning',
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

        // Notificar que el reporte mensual está listo para que loadCharts() construya el gráfico
        this.monthlyReportReady$.next();
      });
  }

  /**
   * Traduce el estado de una cuota al español.
   */
  statusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'Pendiente',
      OVERDUE: 'Vencido',
    };
    return map[status] ?? status;
  }

  /**
   * Carga las cuotas vencidas (OVERDUE). Agrupa por cliente y muestra solo la cuota más antigua
   * de cada uno, ordenada por mayor deuda pendiente primero.
   */
  private loadUpcomingInstallments(): void {
    this.loadingUpcoming = true;
    this.upcomingError = false;
    this.installmentsSvc
      .list({ status: 'OVERDUE' })
      .pipe(
        catchError(() => of([])),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (overdue) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Mapear y agrupar por cliente, manteniendo solo la cuota más antigua
          const overdueByCustomer = overdue
            .map((inst) => ({
              ...inst,
              daysOverdue: Math.abs(
                Math.ceil(
                  (new Date(inst.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                )
              ),
            }))
            .reduce((map, inst) => {
              const key = inst.customerId;
              if (!map.has(key)) {
                map.set(key, inst);
              } else {
                const existing = map.get(key)!;
                // Mantener la cuota con fecha de vencimiento más antigua
                if (new Date(inst.dueDate) < new Date(existing.dueDate)) {
                  map.set(key, inst);
                }
              }
              return map;
            }, new Map<string, any>());

          // Convertir a array, ordenar por mayor deuda y tomar los primeros 5
          const overdueInstallments = Array.from(overdueByCustomer.values())
            .sort((a, b) => (b.amountDue - b.amountPaid) - (a.amountDue - a.amountPaid))
            .slice(0, 5);

          this.upcomingInstallments = overdueInstallments;
          this.loadingUpcoming = false;
        },
        error: () => {
          this.upcomingError = true;
          this.loadingUpcoming = false;
        },
      });
  }

  /**
   * Carga los créditos y cobros pendientes, agrupados por vendedor/cobrador.
   * También verifica si hay cobros pendientes con más de 48 horas sin aprobar.
   */
  private loadPending(): void {
    this.loadingPending = true;

    combineLatest([
      this.creditsSvc.list({ status: 'PENDING_APPROVAL' }).pipe(catchError(() => of([]))),
      this.paymentsSvc.list({ status: 'PENDING' }).pipe(catchError(() => of([]))),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([credits, payments]) => {
        this.pendingCredits = this.groupCreditsBySeller(credits);
        this.pendingPayments = this.groupPaymentsByCollector(payments as any);
        this.checkPendingAlerts(payments);
        this.loadingPending = false;
      });
  }

  private checkPendingAlerts(payments: any[]): void {
    const now = new Date();
    const overdue48h = payments.filter((payment) => {
      if (!payment.createdAt) return false;
      const createdAt = new Date(payment.createdAt);
      const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      return diffHours > 48;
    });

    if (overdue48h.length > 0) {
      const count = overdue48h.length;
      this.alertMessage = `${count} cobro${count > 1 ? 's' : ''} pendiente${count > 1 ? 's' : ''} con más de 48 horas sin revisar. Revisión recomendada.`;
      this.showAlert = true;
    } else {
      this.showAlert = false;
    }
  }

  /**
   * Agrupa créditos pendientes por vendedor. Ordena los créditos dentro de cada grupo por fecha de creación (más antiguos primero).
   */
  private groupCreditsBySeller(credits: Credit[]): PendingCreditGroup[] {
    const grouped = new Map<string | null, Credit[]>();

    credits.forEach((credit) => {
      const seller = credit.createdByName ?? 'Sin asignar';
      if (!grouped.has(seller)) {
        grouped.set(seller, []);
      }
      grouped.get(seller)!.push(credit);
    });

    return Array.from(grouped.entries()).map(([sellerName, items]) => {
      const sortedItems = items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return {
        sellerName,
        count: sortedItems.length,
        totalAmount: sortedItems.reduce((sum, c) => sum + c.totalAmount, 0),
        oldestDate: sortedItems.reduce((oldest, c) => {
          return new Date(c.createdAt) < new Date(oldest) ? c.createdAt : oldest;
        }, sortedItems[0].createdAt),
        credits: sortedItems,
      };
    });
  }

  /**
   * Agrupa cobros pendientes por cobrador. Ordena los cobros dentro de cada grupo por fecha de creación (más antiguos primero).
   */
  private groupPaymentsByCollector(payments: Payment[]): PendingPaymentGroup[] {
    const grouped = new Map<string | null, Payment[]>();

    payments.forEach((payment) => {
      const collector = payment.collectorName ?? 'Sin asignar';
      if (!grouped.has(collector)) {
        grouped.set(collector, []);
      }
      grouped.get(collector)!.push(payment);
    });

    return Array.from(grouped.entries()).map(([collectorName, items]) => {
      const sortedItems = items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return {
        collectorName,
        count: sortedItems.length,
        totalAmount: sortedItems.reduce((sum, p) => sum + p.amountReceived, 0),
        oldestDate: sortedItems.reduce((oldest, p) => {
          return new Date(p.createdAt) < new Date(oldest) ? p.createdAt : oldest;
        }, sortedItems[0].createdAt),
        payments: sortedItems,
      };
    });
  }

  /**
   * Calcula tiempo transcurrido desde una fecha.
   */
  timeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);

    if (diffDays > 0) {
      return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    }
    if (diffHours > 0) {
      return `hace ${diffHours}h`;
    }
    return 'hace poco';
  }

  /**
   * Carga datos reales para los gráficos de análisis.
   */
  private loadCharts(): void {
    this.loadingCharts = true;

    // Convertir a fecha local sin pasar por UTC
    const toLocalDateString = (date: Date): string => {
      const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      return localDate.toISOString().split('T')[0];
    };

    const today = new Date();
    const todayDate = toLocalDateString(today);

    combineLatest([
      this.monthlyReportReady$.pipe(take(1)),
      this.reportsSvc.getCollectorsReport({ dateFrom: todayDate, dateTo: todayDate }, true).pipe(
        catchError((err) => {
          console.error('Error loading collectors report:', err);
          return of([]);
        })
      ),
      this.reportsSvc.getSellersReport({ dateFrom: toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1)), dateTo: todayDate }, true).pipe(
        catchError((err) => {
          console.error('Error loading sellers report:', err);
          return of([]);
        })
      ),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([_, collectors, sellers]) => {
        console.log('Data loaded - collectors:', collectors, 'sellers:', sellers);
        // Reutilizar monthlyCollectionReport cargado en loadKpis
        this.buildWeeklyChart(this.monthlyCollectionReport?.daily ?? []);
        this.buildCollectorsChart(Array.isArray(collectors) ? collectors : []);
        this.buildSellersChart(Array.isArray(sellers) ? sellers : []);
        this.loadingCharts = false;
      });
  }

  /**
   * Construye el gráfico de recaudación semanal.
   */
  private buildWeeklyChart(daily: any[]): void {
    const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const daysMap = new Map<string, number>();

    if (!daily || !Array.isArray(daily)) daily = [];
    // Inicializar con 0 para cada día
    daily.forEach((d: any) => {
      const [year, month, day] = d.day.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const dayName = dayLabels[date.getDay() === 0 ? 6 : date.getDay() - 1];
      daysMap.set(dayName, d.total);
    });

    // Obtener solo días de la semana actual (lunes a hoy)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToShow = dayOfWeek === 0 ? 6 : dayOfWeek;
    const labels = dayLabels.slice(0, daysToShow);
    const data = labels.map(day => daysMap.get(day) ?? 0);

    const textColor = '#8b97b8';
    const gridColor = 'rgba(46, 51, 71, 0.3)';

    this.chartWeeklyData = {
      labels,
      datasets: [
        {
          label: 'Recaudado',
          data,
          backgroundColor: 'rgba(79, 110, 247, 0.5)',
          borderColor: 'rgb(79, 110, 247)',
          borderWidth: 1,
          borderRadius: 4,
          barThickness: 24,
        },
      ],
    };

    this.chartWeeklyOptions = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'x',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => ` ${this.fmt.currency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 11 } },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: textColor,
            font: { size: 11 },
            callback: (v: number) => `$${(v / 1000).toFixed(0)}k`,
          },
          grid: { color: gridColor },
        },
      },
    };

    this.cdr.markForCheck();
  }

  /**
   * Construye el gráfico de ranking de cobradores.
   */
  private buildCollectorsChart(collectors: any[]): void {
    if (!collectors || !Array.isArray(collectors)) collectors = [];
    const top5 = collectors.slice(0, 5);
    const textColor = '#8b97b8';
    const gridColor = 'rgba(46, 51, 71, 0.3)';

    this.chartCollectorsData = {
      labels: top5.map((c) => (c.collectorName || 'Sin asignar').split(' ')[0]),
      datasets: [
        {
          label: 'Monto cobrado',
          data: top5.map(c => c.totalCollected),
          backgroundColor: 'rgba(52, 211, 153, 0.6)',
          borderColor: 'rgb(52, 211, 153)',
          borderWidth: 1,
          borderRadius: 4,
          barThickness: 24,
        },
      ],
    };

    this.chartCollectorsOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => this.fmt.currency(ctx.parsed.y),
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: textColor,
            font: { size: 11 },
          },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: textColor,
            font: { size: 11 },
            callback: (v: number) => `$${(v / 1000).toFixed(0)}k`,
          },
          grid: { color: gridColor },
        },
      },
    };

    this.cdr.markForCheck();
  }

  /**
   * Construye el gráfico de ranking de vendedores.
   */
  private buildSellersChart(sellers: any[]): void {
    if (!sellers || !Array.isArray(sellers)) sellers = [];
    const top5 = sellers.slice(0, 5);
    const textColor = '#8b97b8';
    const gridColor = 'rgba(46, 51, 71, 0.3)';

    this.chartSellersData = {
      labels: top5.map((s) => (s.sellerName || 'Sin asignar').split(' ')[0]),
      datasets: [
        {
          label: 'Monto creado',
          data: top5.map(s => s.totalAmount),
          backgroundColor: 'rgba(251, 191, 36, 0.6)',
          borderColor: 'rgb(251, 191, 36)',
          borderWidth: 1,
          borderRadius: 4,
          barThickness: 24,
        },
      ],
    };

    this.chartSellersOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => this.fmt.currency(ctx.parsed.y),
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: textColor,
            font: { size: 11 },
          },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: textColor,
            font: { size: 11 },
            callback: (v: number) => `$${(v / 1000).toFixed(0)}k`,
          },
          grid: { color: gridColor },
        },
      },
    };

    this.cdr.markForCheck();
  }

  // Quick access navigation methods
  navigateNewCredit(): void {
    this.router.navigate(['/admin/operations/new']);
  }

  navigateRecordPayment(): void {
    this.router.navigate(['/admin/payments']);
  }

  navigateCashRegister(): void {
    this.router.navigate(['/admin/cash-register']);
  }

  navigateGenerateSheet(): void {
    this.router.navigate(['/admin/collections'], {
      queryParams: { openGenerate: 'true' },
    });
  }

  navigateRefinance(): void {
    this.router.navigate(['/admin/operations']);
  }

  navigateNewClient(): void {
    this.router.navigate(['/admin/clients/new']);
  }

  navigateReports(): void {
    this.router.navigate(['/admin/reports']);
  }

  navigateConfig(): void {
    this.router.navigate(['/admin/config']);
  }

  /**
   * Navega a la vista de aprobación de un crédito. Valida que la caja no esté cerrada.
   */
  reviewCredit(creditId: string): void {
    if (this.isCashClosed) {
      this.alertMessage = 'No puedes aprobar créditos. La caja del día está CERRADA.';
      this.showAlert = true;
      return;
    }
    this.router.navigate(['/admin/operations', creditId]);
  }

  /**
   * Aprueba un cobro pendiente y recarga los datos. Valida que la caja no esté cerrada.
   */
  approvePayment(paymentId: string): void {
    if (this.isCashClosed) {
      this.alertMessage = 'No puedes aprobar pagos. La caja del día está CERRADA.';
      this.showAlert = true;
      return;
    }

    this.paymentsSvc
      .approve(paymentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadPending();
          this.loadKpis();
          this.loadCharts();
        },
        error: (err) => {
          console.error('Error al aprobar pago:', err);
          this.alertMessage = 'Error al aprobar el cobro. Intenta nuevamente.';
          this.showAlert = true;
        },
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
   * Devuelve la severidad del estado de una operación reciente.
   */
  private initCharts(): void {
    const textColor = '#6b7280';
    const gridColor = '#f3f4f6';

    this.lineData = {
      labels: MONTH_LIST,
      datasets: [
        {
          label: 'Cobranza ($)',
          data: [
            32000, 41000, 37500, 48920, 52000, 45000, 61000, 57000, 63000,
            71000, 68000, 75000,
          ],
          fill: true,
          tension: 0.4,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.10)',
          pointBackgroundColor: '#2563eb',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#2563eb',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };

    this.lineOptions = {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 0 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => ` ${this.fmt.currency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 11 } },
          grid: { color: gridColor },
          border: { display: false },
        },
        y: {
          ticks: {
            color: textColor,
            font: { size: 11 },
            callback: (v: number) => `$${(v / 1000).toFixed(0)}k`,
          },
          grid: { color: gridColor },
          border: { display: false },
        },
      },
    };

    this.pieData = {
      labels: STATUS_CLIENT,
      datasets: [
        {
          data: [58, 22, 12, 8],
          backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'],
          hoverBackgroundColor: ['#16a34a', '#2563eb', '#d97706', '#dc2626'],
          borderWidth: 2,
          borderColor: '#ffffff',
        },
      ],
    };

    this.pieOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      layout: { padding: 0 },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            font: { size: 12 },
            padding: 14,
            usePointStyle: true,
            pointStyle: 'rect',
            pointStyleWidth: 12,
          },
        },
        tooltip: {
          callbacks: { label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed}%` },
        },
      },
    };
  }
}
