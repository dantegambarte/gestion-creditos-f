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
   * Calcula el total de los próximos vencimientos.
   */
  get upcomingTotal(): number {
    return (this.summary?.upcomingInstallments ?? []).reduce(
      (sum, i) => sum + i.amountDue,
      0,
    );
  }

  /**
   * Calcula la cantidad de días restantes hasta una fecha dada.
   * Devuelve null si la fecha es nula, o negativo si ya venció.
   * @param dateStr
   * @returns
   */
  daysUntil(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
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
