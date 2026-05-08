import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { AppError } from '../../../core/models/app-error';
import { HeaderService } from '../../../core/services/header.service';
import { ErrorStateComponent } from '../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/states/loading-state/loading-state.component';
import { CollectionsService } from '../../collector/collections.service';
import {
  COLLECTION_FILTER_LABELS,
  CollectionSheetDetail,
} from '../../collector/models/collection.model';
import { InstallmentStatus } from '../../seller/models/installment.model';
import { AppRoutes } from '../../../shared/models/enums/routes.enum';

@Component({
  selector: 'app-admin-collection-detail',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    DatePipe,
    ButtonModule,
    TagModule,
    TooltipModule,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  templateUrl: './admin-collection-detail.component.html',
})
export class AdminCollectionDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly collectionsService = inject(CollectionsService);
  private readonly router = inject(Router);
  private readonly header = inject(HeaderService);

  sheet: CollectionSheetDetail | null = null;
  loading = true;
  error: AppError | null = null;

  private get sheetId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit(): void {
    this.header.set([
      { label: 'Planillas de cobro', route: '/admin/collections' },
      { label: 'Detalle' },
    ]);
    this.load();
  }

  /**
   * Navega a la página anterior en el historial del navegador.
   */
  goBack(): void {
    this.router.navigate([AppRoutes.ADMIN, AppRoutes.ADMIN_COLLECTIONS]);
  }

  /**
   * Navega a la página de detalle del crédito.
   * @param creditId
   */
  goToCredit(creditId: string): void {
    this.router.navigate([AppRoutes.OPERATIONS_DETAIL, creditId]);
  }

  /**
   * Devuelve la etiqueta correspondiente al filtro.
   * @param f
   * @returns
   */
  filterLabel(f: string): string {
    return (
      COLLECTION_FILTER_LABELS[f as keyof typeof COLLECTION_FILTER_LABELS] ?? f
    );
  }

  /**
   * Devuelve el nivel de severidad correspondiente al estado de la cuota.
   * @param status
   * @returns
   */
  installmentSeverity(
    status: InstallmentStatus,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    const map: Record<
      InstallmentStatus,
      'success' | 'info' | 'warning' | 'danger' | 'secondary'
    > = {
      PENDING: 'info',
      OVERDUE: 'danger',
      PAID: 'success',
      PARTIAL: 'warning',
    };
    return map[status] ?? 'secondary';
  }

  /**
   * Devuelve la etiqueta correspondiente al estado de la cuota.
   * @param status
   * @returns
   */
  installmentLabel(status: InstallmentStatus): string {
    const map: Record<InstallmentStatus, string> = {
      PENDING: 'Pendiente',
      OVERDUE: 'Vencida',
      PAID: 'Pagada',
      PARTIAL: 'Parcial',
    };
    return map[status] ?? status;
  }

  /**
   * Carga los detalles de la planilla de cobro. Si la carga es exitosa, actualiza el encabezado de la página con el nombre del cobrador y la fecha de la planilla. Si ocurre un error, almacena el error para mostrarlo en la interfaz. En ambos casos, actualiza el estado de carga.
   */
  private load(): void {
    this.loading = true;
    this.collectionsService.getById(this.sheetId).subscribe({
      next: (data) => {
        this.sheet = data;
        this.header.set([
          { label: 'Planillas de cobro', route: '/admin/collections' },
          {
            label: `${data.collectorName} — ${new Date(data.sheetDate).toLocaleDateString('es-AR')}`,
          },
        ]);
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }
}
