import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';

import { AuthServiceBase } from '../../core/auth/auth-service.base';
import { UserRoleEnum } from '../../core/models/types/user-role';
import { HeaderService } from '../../core/services/header.service';
import { UsersService } from '../../features/admin/users/users.service';
import { CustomersService } from '../../features/seller/clients/customers.service';
import { Customer } from '../../features/seller/models/customer.model';
import { AppRoutes } from '../models/enums/routes.enum';
import { Client } from '../models/interface/client';
import { ClientCreateDialogComponent } from './client-create-dialog.component';
import { ClientEditDialogComponent } from './client-edit-dialog.component';

const AVATAR_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
];

function toClient(c: Customer): Client {
  const parts = c.fullName.trim().split(/\s+/);
  const initials = (
    (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  ).toUpperCase();
  const colorIdx = c.fullName.charCodeAt(0) % AVATAR_COLORS.length;
  return {
    id: c.id,
    dni: c.dni,
    initials,
    avatarColor: AVATAR_COLORS[colorIdx],
    name: c.fullName,
    phone: c.phone ?? '',
    credits: c.activeCredits ?? 0,
    risk: c.delinquency ?? 'Al dia',
    email: c.email ?? undefined,
    address: c.address ?? undefined,
    collectorId: c.collectorId ?? undefined,
  };
}

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    IconFieldModule,
    InputIconModule,
    TagModule,
    DialogModule,
    ToastModule,
    ClientCreateDialogComponent,
    ClientEditDialogComponent,
  ],
  providers: [MessageService],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss',
})
export class ClientsComponent implements OnInit, OnDestroy {
  private readonly customersService = inject(CustomersService);
  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthServiceBase);
  private readonly header = inject(HeaderService);
  private readonly router = inject(Router);

  clients: Client[] = [];
  loading = false;
  collectorOptions: { label: string; value: string }[] = [];
  collectorsLoading = false;

  filterOptions = [
    { label: 'Todos', value: null },
    { label: 'Al día', value: 'Al dia' },
    { label: 'Mora leve', value: 'Mora leve' },
    { label: 'Mora alta', value: 'Mora alta' },
  ];

  selectedFilter: string | null = null;
  searchTerm = '';
  showCreateModal = false;
  showEditModal = false;
  showViewModal = false;
  selectedClient: Client | null = null;

  /**
   * Indica si el usuario actual puede editar clientes.
   */
  get canEditClients(): boolean {
    return this.auth.hasRole(UserRoleEnum.ADMIN);
  }

  get filteredClients(): Client[] {
    return this.clients.filter((c) => {
      const matchesSearch =
        !this.searchTerm ||
        c.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        c.dni.includes(this.searchTerm);
      const matchesFilter =
        !this.selectedFilter || c.risk === this.selectedFilter;
      return matchesSearch && matchesFilter;
    });
  }

  ngOnInit(): void {
    this.header.set([{ label: 'Clientes' }]);
    this.loadCollectors();
    this.loadClients();
  }

  ngOnDestroy(): void {
    this.header.reset();
  }

  /**
   * Carga los cobradores activos para los selects de los dialogs.
   */
  private loadCollectors(): void {
    this.collectorsLoading = true;
    this.usersService.listCollectors().subscribe({
      next: (collectors) => {
        this.collectorOptions = collectors.map((c) => ({
          label: c.fullName,
          value: c.id,
        }));
        this.collectorsLoading = false;
      },
      error: () => {
        this.collectorsLoading = false;
      },
    });
  }

  /**
   * Carga la lista de clientes activos y la transforma al formato de la interfaz.
   */
  loadClients(): void {
    this.loading = true;
    this.customersService
      .list({ status: 'ACTIVE', includeSummary: true })
      .subscribe({
        next: (customers) => {
          this.clients = customers.map(toClient);
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  /**
   * Devuelve la severidad del badge de riesgo.
   * @param risk nivel de riesgo
   */
  getRiskSeverity(
    risk: string,
  ): 'success' | 'warning' | 'danger' | 'secondary' {
    switch (risk) {
      case 'Al dia':
        return 'success';
      case 'Mora leve':
        return 'warning';
      case 'Mora alta':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  /**
   * Devuelve la etiqueta legible del nivel de riesgo.
   * @param risk nivel de riesgo
   */
  getRiskLabel(risk: string): string {
    return risk === 'Al dia' ? 'Al día' : risk;
  }

  /**
   * Navega al detalle del cliente.
   * @param client cliente seleccionado
   */
  openView(client: Client): void {
    const base = this.router.url.split(`/${AppRoutes.CLIENTS}`)[0];
    this.router.navigate([base, AppRoutes.CLIENTS, client.id]);
  }

  /**
   * Abre el dialog de edición para el cliente seleccionado.
   * @param client cliente a editar
   */
  openEdit(client: Client): void {
    if (!this.canEditClients) return;
    this.selectedClient = client;
    this.showEditModal = true;
  }

  /**
   * Navega a los créditos del cliente.
   * @param client cliente seleccionado
   */
  openCredits(client: Client): void {
    const base = this.router.url.split(`/${AppRoutes.CLIENTS}`)[0];
    this.router.navigate([base, AppRoutes.CLIENTS, client.id]);
  }
}
