import { FfBackTopFabComponent } from './../../../shared/components/back-top-fab/ff-back-top-fab.component';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SkeletonModule } from 'primeng/skeleton';
import { PortalService } from '../portal.service';
import { PortalCredit } from '../models/portal.models';

@Component({
  selector: 'app-portal-credits',
  standalone: true,
  imports: [FfBackTopFabComponent,CommonModule, CurrencyPipe, DatePipe, SkeletonModule, RouterLink],
  templateUrl: './portal-credits.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalCreditsComponent implements OnInit {
  private readonly portalService = inject(PortalService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  credits: PortalCredit[] = [];
  loading = true;
  error = '';

  /** Total de créditos del cliente. */
  get totalCredits(): number {
    return this.credits.length;
  }

  /** Cantidad de créditos activos. */
  get activeCreditsCount(): number {
    return this.credits.filter((c) => c.status === 'ACTIVE').length;
  }

  /**
   * Créditos activos ordenados por urgencia:
   * primero los que tienen mora, luego por fecha de próximo vencimiento.
   */
  get activeCredits(): PortalCredit[] {
    return this.credits
      .filter((c) => c.status === 'ACTIVE')
      .sort((a, b) => {
        if (a.hasOverdue && !b.hasOverdue) return -1;
        if (!a.hasOverdue && b.hasOverdue) return 1;
        if (a.nextDueDate && b.nextDueDate) return a.nextDueDate.localeCompare(b.nextDueDate);
        if (a.nextDueDate) return -1;
        if (b.nextDueDate) return 1;
        return 0;
      });
  }

  /** Créditos liquidados. */
  get settledCredits(): PortalCredit[] {
    return this.credits.filter((c) => c.status === 'SETTLED');
  }

  /** Indica si algún crédito activo tiene cuotas vencidas. */
  get hasAnyOverdue(): boolean {
    return this.credits.some((c) => c.hasOverdue);
  }

  /** Cantidad de créditos activos con cuotas vencidas. */
  get overdueCreditsCount(): number {
    return this.activeCredits.filter((c) => c.hasOverdue).length;
  }

  /** Suma de mora pendiente en todos los créditos activos. */
  get totalPendingPenalty(): number {
    return this.activeCredits.reduce((sum, c) => sum + c.pendingPenalty, 0);
  }

  /**
   * Fecha de vencimiento más próxima entre los créditos activos sin mora.
   * Se usa en el banner de "todo al día" para indicar el siguiente pago.
   */
  get nextUrgentDueDate(): string | null {
    return this.activeCredits.find((c) => !c.hasOverdue && c.nextDueDate)?.nextDueDate ?? null;
  }

  /** Estado del filtro activo. */
  filterState: 'ALL' | 'ON_TIME' | 'OVERDUE' | 'SETTLED' = 'ALL';

  /** Cantidad de créditos activos sin mora. */
  get onTimeCount(): number {
    return this.activeCredits.filter((c) => !c.hasOverdue).length;
  }

  /**
   * Créditos activos visibles según el filtro seleccionado.
   */
  get filteredActiveCredits(): PortalCredit[] {
    if (this.filterState === 'SETTLED') return [];
    if (this.filterState === 'OVERDUE') return this.activeCredits.filter((c) => c.hasOverdue);
    if (this.filterState === 'ON_TIME') return this.activeCredits.filter((c) => !c.hasOverdue);
    return this.activeCredits;
  }

  /**
   * Créditos liquidados visibles según el filtro seleccionado.
   */
  get filteredSettledCredits(): PortalCredit[] {
    if (this.filterState === 'ON_TIME' || this.filterState === 'OVERDUE') return [];
    return this.settledCredits;
  }

  /**
   * Aplica el filtro seleccionado.
   * @param state
   */
  setFilter(state: 'ALL' | 'ON_TIME' | 'OVERDUE' | 'SETTLED'): void {
    this.filterState = state;
  }

  /**
   * Calcula la deuda restante aproximada de un crédito a partir de las cuotas
   * no pagadas y la mora pendiente.
   * Devuelve null si no hay suficiente información para el cálculo.
   * @param credit
   */
  remainingDebt(credit: PortalCredit): number | null {
    if (credit.installmentAmount == null || !credit.totalInstallments) return null;
    const unpaid = Math.max(0, credit.totalInstallments - credit.paidInstallments);
    return unpaid * credit.installmentAmount + credit.pendingPenalty;
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.portalService
      .getCredits()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.credits = data;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.message ?? 'Error al cargar los créditos.';
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Calcula el porcentaje de progreso para un crédito dado.
   * @param credit
   * @returns
   */
  progressPercent(credit: PortalCredit): number {
    if (!credit.totalInstallments) return 0;
    return Math.round((credit.paidInstallments / credit.totalInstallments) * 100);
  }

  /**
   * Devuelve el nombre de visualización de un crédito.
   * Para LOAN devuelve "Préstamo Personal" si no hay nombre registrado.
   * @param credit
   * @returns
   */
  creditDisplayName(credit: PortalCredit): string {
    return credit.name ?? 'Préstamo Personal';
  }

  /**
   * Devuelve la unidad de frecuencia abreviada para mostrar junto al monto de cuota.
   * @param freq
   * @returns
   */
  frequencyUnit(freq: PortalCredit['paymentFrequency']): string {
    switch (freq) {
      case 'MONTHLY':   return 'mes';
      case 'WEEKLY':    return 'sem.';
      case 'BIWEEKLY':  return 'quincena';
    }
  }

  /**
   * Calcula la cantidad de días restantes hasta la próxima fecha de vencimiento.
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
   * Navega a la vista detallada de un crédito.
   * @param id
   */
  goToDetail(id: string): void {
    this.router.navigate(['/portal/credits', id]);
  }
}
