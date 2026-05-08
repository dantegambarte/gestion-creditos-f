import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { MockAuthService } from '../../../../core/auth/mock-auth.service';
import { HeaderService } from '../../../../core/services/header.service';
import { CustomersService } from '../customers.service';
import {
  Customer,
  CustomerListFilters,
  CustomerStatus,
} from '../../models/customer.model';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/states/empty-state/empty-state.component';
import { AppError } from '../../../../core/models/app-error';
import { UserRoleEnum } from '../../../../core/models/types/user-role';
import { AppRoutes } from '../../../../shared/models/enums/routes.enum';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [
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
  templateUrl: './clients-list.component.html',
})
export class ClientsListComponent implements OnInit, OnDestroy {
  private readonly customersService = inject(CustomersService);
  private readonly auth = inject(MockAuthService);
  private readonly router = inject(Router);
  private readonly header = inject(HeaderService);

  customers: Customer[] = [];
  loading = false;
  error: AppError | null = null;

  searchTerm = '';
  selectedStatus: CustomerStatus | null = null;
  selectedCollectorId: string | null = null;

  readonly statusOptions = [
    { label: 'Activo', value: 'ACTIVE' },
    { label: 'Inactivo', value: 'INACTIVE' },
  ];

  /**
   * Verifica si el usuario tiene permisos para crear nuevos clientes.
   * @returns {boolean} - Verdadero si el usuario puede crear clientes, falso en caso contrario.
   */
  get canCreate(): boolean {
    return this.auth.hasAnyRole([
      UserRoleEnum.ADMIN,
      UserRoleEnum.SELLER,
      UserRoleEnum.SELLER_COLLECTOR,
    ]);
  }

  /**
   * Verifica si el usuario tiene permisos para filtrar clientes por cobrador asignado.
   * @returns {boolean} - Verdadero si el usuario puede filtrar por cobrador, falso en caso contrario.
   */
  get canFilterByCollector(): boolean {
    return this.auth.hasAnyRole([
      UserRoleEnum.ADMIN,
      UserRoleEnum.SELLER,
      UserRoleEnum.SELLER_COLLECTOR,
    ]);
  }

  private readonly searchSubject = new Subject<string>();
  private sub?: Subscription;

  ngOnInit(): void {
    this.header.set([{ label: 'Clientes' }]);
    this.loadCustomers();

    this.sub = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.loadCustomers());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /**
   * Maneja el cambio en el campo de búsqueda.
   * @param value
   */
  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  /**
   * Aplica los filtros seleccionados y recarga la lista de clientes.
   */
  applyFilters(): void {
    this.loadCustomers();
  }

  /**
   * Navega a la vista de detalle de un cliente.
   * @param id - El ID del cliente.
   */
  navigateToDetail(id: string): void {
    this.router.navigate(['/seller', AppRoutes.CLIENTS, id]);
  }

  /**
   * Navega a la vista de creación de un nuevo cliente.
   */
  navigateToCreate(): void {
    this.router.navigate(['/seller', AppRoutes.CLIENTS, 'new']);
  }

  /**
   * Carga la lista de clientes aplicando los filtros seleccionados. Maneja el estado de carga y errores.
   */
  private loadCustomers(): void {
    const filters: CustomerListFilters = {};
    if (this.selectedStatus) filters.status = this.selectedStatus;
    if (this.searchTerm.trim()) filters.search = this.searchTerm.trim();
    if (this.selectedCollectorId)
      filters.collectorId = this.selectedCollectorId;

    this.loading = true;
    this.error = null;
    this.customersService.list(filters).subscribe({
      next: (data) => {
        this.customers = data;
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }
}
