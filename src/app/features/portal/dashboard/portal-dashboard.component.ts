import { CommonModule, CurrencyPipe, DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SkeletonModule } from 'primeng/skeleton';
import { AccountSummary, UpcomingInstallment } from '../models/portal.models';
import { PortalAuthService } from '../auth/portal-auth.service';
import { PortalService } from '../portal.service';

@Component({
  selector: 'app-portal-dashboard',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink, SkeletonModule],
  templateUrl: './portal-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalDashboardComponent implements OnInit {
  private readonly portalService = inject(PortalService);
  private readonly authService = inject(PortalAuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  summary: AccountSummary | null = null;
  loading = true;
  error = '';

  get firstName(): string {
    const name = this.authService.snapshot?.fullName ?? '';
    return name.split(' ')[0] ?? name;
  }

  /**
   * Cuotas con estado OVERDUE dentro de los próximos vencimientos.
   */
  get overdueInstallments() {
    return (this.summary?.upcomingInstallments ?? []).filter(i => i.status === 'OVERDUE');
  }

  /**
   * Cuotas PENDING o PARTIAL (no vencidas) dentro de los próximos 30 días.
   */
  get pendingInstallments() {
    return (this.summary?.upcomingInstallments ?? []).filter(i => i.status !== 'OVERDUE');
  }

  /**
   * Primera cuota pendiente (no vencida) más próxima a vencer.
   * Es el dato más accionable para el usuario.
   */
  get nextPendingInstallment() {
    return this.pendingInstallments[0] ?? null;
  }

  /**
   * Porcentaje de progreso global de pago sobre el total de cuotas.
   */
  get progressPercent(): number {
    const total = this.summary?.totalInstallmentsCount ?? 0;
    if (!total) return 0;
    return Math.round((this.summary!.paidCount / total) * 100);
  }

  /**
   * Total en pesos de las cuotas pendientes (no vencidas) próximas a vencer.
   */
  get pendingUpcomingTotal(): number {
    return this.pendingInstallments.reduce((sum, i) => sum + i.amountDue, 0);
  }

  /**
   * Calcula la cantidad de días restantes hasta una fecha dada.
   * Devuelve null si la fecha es nula, o negativo si ya venció.
   * @param dateStr
   * @returns
   */
  daysUntil(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
    const due   = new Date(y, m - 1, d);   // medianoche local de la fecha de vencimiento
    const today = new Date();
    today.setHours(0, 0, 0, 0);             // medianoche local de hoy
    return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Devuelve la etiqueta del tipo de crédito para mostrar en la lista de próximos vencimientos.
   * @param inst
   * @returns
   */
  upcomingTypeLabel(inst: UpcomingInstallment): string {
    return inst.creditType === 'SALE' ? 'VENTA' : 'PRÉSTAMO';
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.portalService
      .getAccountSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.summary = data;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.message ?? 'Error al cargar el resumen.';
          this.cdr.markForCheck();
        },
      });
  }
}
