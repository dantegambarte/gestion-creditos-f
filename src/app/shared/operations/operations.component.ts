import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { CurrencyArsPipe } from '../../core/pipes/currency-ars.pipe';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';

import {
  Credit,
  CreditStatus,
  CreditType,
} from '../../features/seller/models/credit.model';
import { CreditsService } from '../../features/seller/operations/credits.service';

@Component({
  selector: 'operations',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    CommonModule,
    FormsModule,
    RouterLink,
    TableModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    IconFieldModule,
    InputIconModule,
    DialogModule,
  ],
  templateUrl: './operations.component.html',
  styleUrl: './operations.component.scss',
})
export class OperationsComponent implements OnInit {
  private readonly creditsService = inject(CreditsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  operations: Credit[] = [];
  loading = false;

  statusOptions = [
    { label: 'Todos', value: null },
    { label: 'Pendiente de aprobación', value: 'PENDING_APPROVAL' as CreditStatus },
    { label: 'Activo', value: 'ACTIVE' as CreditStatus },
    { label: 'Liquidado', value: 'SETTLED' as CreditStatus },
    { label: 'Rechazado', value: 'REJECTED' as CreditStatus },
  ];

  selectedStatus: CreditStatus | null = null;
  searchTerm = '';

  showNewOperationModal = false;

  ngOnInit(): void {
    this.loadOperations();
  }

  /**
   * Devuelve una clase de severidad según el estado real del crédito.
   * @param {CreditStatus} status - Estado recibido desde backend.
   * @returns {'warning' | 'success' | 'secondary' | 'danger'} Severidad visual del badge.
   */
  getStatusSeverity(status: CreditStatus): 'warning' | 'success' | 'secondary' | 'danger' {
    switch (status) {
      case 'PENDING_APPROVAL':
        return 'warning';
      case 'ACTIVE':
        return 'success';
      case 'SETTLED':
        return 'secondary';
      case 'REJECTED':
        return 'danger';
    }
  }

  /**
   * Traduce el estado técnico del backend a una etiqueta legible para la tabla.
   * @param {CreditStatus} status - Estado real del crédito.
   * @returns {string} Texto visible para el usuario.
   */
  getStatusLabel(status: CreditStatus): string {
    switch (status) {
      case 'PENDING_APPROVAL':
        return 'PEND. APROBACIÓN';
      case 'ACTIVE':
        return 'ACTIVO';
      case 'SETTLED':
        return 'LIQUIDADO';
      case 'REJECTED':
        return 'RECHAZADO';
    }
  }

  /**
   * Traduce el tipo técnico del crédito a la etiqueta usada en la UI.
   * @param {CreditType} type - Tipo del crédito recibido desde backend.
   * @returns {string} Tipo legible para la tabla.
   */
  getTypeLabel(type: CreditType): string {
    return type === 'SALE' ? 'VENTA' : 'PRÉSTAMO';
  }

  /**
   * Devuelve el listado visible aplicando filtro de estado y búsqueda por cliente o DNI.
   * La búsqueda ignora mayúsculas/minúsculas y tildes para evitar falsos negativos.
   */
  get filteredOperations(): Credit[] {
    const term = this.normalizeText(this.searchTerm);

    return this.operations.filter((operation) => {
      const matchesStatus =
        !this.selectedStatus || operation.status === this.selectedStatus;

      if (!term) {
        return matchesStatus;
      }

      const normalizedClient = this.normalizeText(operation.customerName);
      const normalizedDni = this.normalizeText(operation.customerDni);

      return (
        matchesStatus &&
        (normalizedClient.includes(term) || normalizedDni.includes(term))
      );
    });
  }

  /**
   * Navega al detalle de la operación usando la ruta relativa al módulo activo.
   * @param {string} id - ID del crédito a visualizar.
   */
  navigateToDetail(id: string): void {
    this.router.navigate([id], { relativeTo: this.route });
  }

  /**
   * Carga las operaciones reales desde backend para reemplazar la tabla mockeada.
   */
  loadOperations(): void {
    this.loading = true;

    this.creditsService.list().subscribe({
      next: (operations) => {
        this.operations = operations;
        this.loading = false;
      },
      error: () => {
        this.operations = [];
        this.loading = false;
      },
    });
  }

  /**
   * Abre el modal de nueva operación.
   */
  openNewOperation(): void {
    this.showNewOperationModal = true;
  }

  /**
   * Cierra el modal de nueva operación.
   */
  closeNewOperation(): void {
    this.showNewOperationModal = false;
  }

  /**
   * Normaliza un texto para comparaciones flexibles.
   * @param {string} value - Texto original.
   * @returns {string} Texto sin diacríticos, en minúsculas y sin espacios sobrantes.
   */
  private normalizeText(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
