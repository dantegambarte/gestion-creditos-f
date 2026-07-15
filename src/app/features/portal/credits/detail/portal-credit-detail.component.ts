import { CommonModule, CurrencyPipe, DatePipe, isPlatformBrowser, Location } from '@angular/common';
import { FfBackTopFabComponent } from './../../../../shared/components/back-top-fab/ff-back-top-fab.component';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SkeletonModule } from 'primeng/skeleton';
import {
  PortalCreditDetail,
  PortalInstallment,
} from '../../models/portal.models';
import { PortalService } from '../../portal.service';

@Component({
  selector: 'app-portal-credit-detail',
  standalone: true,
  imports: [FfBackTopFabComponent,CommonModule, CurrencyPipe, DatePipe, SkeletonModule],
  templateUrl: './portal-credit-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalCreditDetailComponent implements OnInit {
  private readonly portalService = inject(PortalService);
  private readonly route         = inject(ActivatedRoute);
  private readonly location      = inject(Location);
  private readonly platformId    = inject(PLATFORM_ID);
  private readonly destroyRef    = inject(DestroyRef);
  private readonly cdr           = inject(ChangeDetectorRef);

  credit: PortalCreditDetail | null = null;
  loading = true;
  error = '';

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const id = this.route.snapshot.paramMap.get('id')!;
    this.portalService
      .getCreditById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.credit = data;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.message ?? 'Error al cargar el crédito.';
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Devuelve el nombre de visualización del crédito.
   * Para LOAN devuelve "Préstamo Personal" si no hay nombre registrado.
   */
  get displayName(): string {
    return this.credit?.name ?? 'Préstamo Personal';
  }

  /**
   * Devuelve el monto de la primera cuota como referencia del monto estándar de cuota.
   */
  get installmentAmount(): number {
    return this.credit?.installments?.[0]?.amountDue ?? 0;
  }

  /**
   * Devuelve la etiqueta de frecuencia de pago.
   */
  get frequencyLabel(): string {
    switch (this.credit?.paymentFrequency) {
      case 'DAILY':     return 'Diaria';
      case 'WEEKLY':    return 'Semanal';
      case 'BIWEEKLY':  return 'Quincenal';
      case 'MONTHLY':   return 'Mensual';
      default:          return this.credit?.paymentFrequency ?? '';
    }
  }

  /**
   * Devuelve la etiqueta de la tasa de interés incluyendo el período.
   * Para créditos de venta se muestra "Por producto"; para préstamos, porcentaje + período.
   */
  get interestRateLabel(): string {
    if (this.credit?.type === 'SALE') return 'Por producto';
    if (this.credit?.interestRate == null) return 'Sin tasa';
    return `${(this.credit.interestRate * 100).toFixed(2)}% ${this.frequencyLabel.toLowerCase()}`;
  }

  /**
   * Primera cuota no pagada (siguiente a abonar o ya vencida).
   */
  get nextInstallment(): PortalInstallment | null {
    return (this.credit?.installments ?? []).find((i) => i.status !== 'PAID') ?? null;
  }

  /**
   * Indica si el crédito está completamente liquidado.
   */
  get isSettled(): boolean {
    return this.credit?.status === 'SETTLED';
  }

  /**
   * Calcula el porcentaje de progreso del crédito basado en cuotas pagadas.
   */
  get progressPercent(): number {
    if (!this.credit?.installmentsCount) return 0;
    const paid = this.paidCount;
    return Math.round((paid / this.credit.installmentsCount) * 100);
  }

  /**
   * Cantidad de cuotas pagadas.
   */
  get paidCount(): number {
    return (this.credit?.installments ?? []).filter(
      (i) => i.status === 'PAID',
    ).length;
  }

  /**
   * Cantidad de cuotas pendientes (incluyendo parciales).
   */
  get pendingCount(): number {
    return (this.credit?.installments ?? []).filter(
      (i) => i.status === 'PENDING' || i.status === 'PARTIAL',
    ).length;
  }

  /**
   * Cantidad de cuotas vencidas.
   */
  get overdueCount(): number {
    return (this.credit?.installments ?? []).filter(
      (i) => i.status === 'OVERDUE',
    ).length;
  }

  /**
   * Calcula el total ya pagado sumando los montos pagados de cada cuota.
   */
  get totalPaid(): number {
    return (this.credit?.installments ?? []).reduce(
      (sum, i) => sum + i.amountPaid,
      0,
    );
  }

  /**
   * Calcula la deuda restante sumando la diferencia entre monto debido y pagado
   * de las cuotas que no están completamente pagadas.
   */
  get pendingBalance(): number {
    return (this.credit?.installments ?? [])
      .filter((i) => i.status !== 'PAID')
      .reduce((sum, i) => sum + (i.amountDue - i.amountPaid), 0);
  }

  /**
   * Calcula el total de mora acumulada en todas las cuotas.
   */
  get totalPenalty(): number {
    return (this.credit?.installments ?? []).reduce(
      (sum, i) => sum + i.penaltyAmount,
      0,
    );
  }

  /**
   * Devuelve una etiqueta legible para el estado de una cuota.
   * @param status
   * @returns
   */
  installmentLabel(status: PortalInstallment['status']): string {
    switch (status) {
      case 'PENDING': return 'PENDIENTE';
      case 'OVERDUE': return 'VENCIDA';
      case 'PARTIAL': return 'PARCIAL';
      case 'PAID':    return 'PAGADO';
    }
  }

  /**
   * Vuelve a la pantalla anterior respetando el historial de navegación.
   */
  goBack(): void {
    this.location.back();
  }
}
