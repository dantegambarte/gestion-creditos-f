import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AuthServiceBase } from '../../../../core/auth/auth-service.base';
import { AppError } from '../../../../core/models/app-error';
import { UserRoleEnum } from '../../../../core/models/types/user-role';
import { HeaderService } from '../../../../core/services/header.service';
import { EmptyStateComponent } from '../../../../shared/states/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import {
  Credit,
  CreditListFilters,
  CreditStatus,
  CreditType,
} from '../../models/credit.model';
import { CreditsService } from '../credits.service';
import { AppRoutes } from '../../../../shared/models/enums/routes.enum';

@Component({
  selector: 'app-credits-list',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    CommonModule,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    LoadingStateComponent,
    ErrorStateComponent,
    EmptyStateComponent,
  ],
  templateUrl: './credits-list.component.html',
})
export class CreditsListComponent implements OnInit {
  private readonly creditsService = inject(CreditsService);
  private readonly auth = inject(AuthServiceBase);
  private readonly router = inject(Router);
  private readonly header = inject(HeaderService);

  credits: Credit[] = [];
  filteredCredits: Credit[] = [];
  loading = false;
  error: AppError | null = null;

  searchTerm = '';
  selectedStatus: CreditStatus | null = null;
  selectedType: CreditType | null = null;

  readonly statusOptions = [
    { label: 'Pendiente de aprobación', value: 'PENDING_APPROVAL' },
    { label: 'Activo', value: 'ACTIVE' },
    { label: 'Liquidado', value: 'SETTLED' },
    { label: 'Rechazado', value: 'REJECTED' },
  ];

  readonly typeOptions = [
    { label: 'Venta', value: 'SALE' },
    { label: 'Préstamo', value: 'LOAN' },
  ];

  get canCreate(): boolean {
    return this.auth.hasAnyRole([
      UserRoleEnum.ADMIN,
      UserRoleEnum.SELLER,
      UserRoleEnum.SELLER_COLLECTOR,
    ]);
  }

  ngOnInit(): void {
    this.header.set([{ label: 'Operaciones' }]);
    this.load();
  }

  applyFilters(): void {
    this.load();
  }

  onSearchChange(): void {
    this.applyClientFilters();
  }

  private applyClientFilters(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredCredits = this.credits;
      return;
    }
    this.filteredCredits = this.credits.filter(
      (c) =>
        c.customerName.toLowerCase().includes(term) ||
        c.customerDni.toLowerCase().includes(term),
    );
  }

  /**
   * Navega hacia la página de creación de una nueva operación.
   */
  navigateToCreate(): void {
    this.router.navigate([AppRoutes.SELLER_OPERATIONS]);
  }

  /**
   * Navega hacia la página de detalle de una operación.
   * @param id
   */
  navigateToDetail(id: string): void {
    this.router.navigate(['/seller/operations', id]);
  }

  /**
   * Obtiene la etiqueta legible para un estado de crédito.
   * @param status
   * @returns
   */
  statusLabel(status: CreditStatus): string {
    const map: Record<CreditStatus, string> = {
      PENDING_APPROVAL: 'Pendiente de aprobación',
      ACTIVE: 'Activo',
      SETTLED: 'Liquidado',
      REJECTED: 'Rechazado',
      EXPIRED: 'Vencido',
      REFINANCED: 'Refinanciado',
    };
    return map[status];
  }

  /**
   * Obtiene la severidad para un estado de crédito.
   * @param status
   * @returns
   */
  statusSeverity(
    status: CreditStatus,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    const map: Record<
      CreditStatus,
      'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast'
    > = {
      PENDING_APPROVAL: 'warning',
      ACTIVE: 'success',
      SETTLED: 'secondary',
      REJECTED: 'danger',
      EXPIRED: 'danger',
      REFINANCED: 'contrast',
    };
    return map[status];
  }

  /**
   * Obtiene la etiqueta legible para una frecuencia de pago.
   * @param frequency
   * @returns
   */
  frequencyLabel(frequency: string | null | undefined): string {
    if (!frequency) return '';
    const map: Record<string, string> = {
      WEEKLY: 'semanal',
      BIWEEKLY: 'quincenal',
      MONTHLY: 'mensual',
    };
    return map[frequency] ?? frequency.toLowerCase();
  }

  private load(): void {
    const filters: CreditListFilters = {};
    if (this.selectedStatus) filters.status = this.selectedStatus;
    if (this.selectedType) filters.type = this.selectedType;

    this.loading = true;
    this.error = null;
    this.creditsService.list(filters).subscribe({
      next: (data) => {
        this.credits = data;
        this.loading = false;
        this.applyClientFilters();
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }
}
