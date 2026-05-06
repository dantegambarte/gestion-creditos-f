import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { PortalService } from '../portal.service';
import { PortalCredit } from '../models/portal.models';

@Component({
  selector: 'app-portal-credits',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, SkeletonModule],
  templateUrl: './portal-credits.component.html',
})
export class PortalCreditsComponent implements OnInit {
  private readonly portalService = inject(PortalService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

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

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.portalService.getCredits().subscribe({
      next: (data) => {
        this.credits = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.message ?? 'Error al cargar los créditos.';
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
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Navega a la vista detallada de un crédito.
   * @param id
   */
  goToDetail(id: string): void {
    this.router.navigate(['/portal/credits', id]);
  }
}
