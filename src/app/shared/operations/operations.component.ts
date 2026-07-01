import { CommonModule } from '@angular/common';
import { FfBackTopFabComponent } from './../components/back-top-fab/ff-back-top-fab.component';
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
import { SkeletonModule } from 'primeng/skeleton';
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
    FfBackTopFabComponent,
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
    SkeletonModule,
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
    { label: 'Estado', value: null },
    {
      label: 'Pendiente de aprobación',
      value: 'PENDING_APPROVAL' as CreditStatus,
    },
    { label: 'Activo', value: 'ACTIVE' as CreditStatus },
    { label: 'Liquidado', value: 'SETTLED' as CreditStatus },
    { label: 'Rechazado', value: 'REJECTED' as CreditStatus },
    { label: 'Aprobación vencida', value: 'EXPIRED' as CreditStatus },
    { label: 'Refinanciado', value: 'REFINANCED' as CreditStatus },
    { label: 'Castigado', value: 'WRITTEN_OFF' as CreditStatus },
  ];

  typeOptions = [
    { label: 'Tipo', value: null },
    { label: 'Venta', value: 'SALE' as CreditType },
    { label: 'Préstamo', value: 'LOAN' as CreditType },
  ];

  selectedStatus: CreditStatus | null = null;
  selectedType: CreditType | null = null;
  selectedSeller: string | null = null;
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
  getStatusSeverity(
    status: CreditStatus,
  ): 'warning' | 'success' | 'secondary' | 'danger' {
    switch (status) {
      case 'PENDING_APPROVAL':
        return 'warning';
      case 'ACTIVE':
        return 'success';
      case 'SETTLED':
        return 'secondary';
      case 'REJECTED':
        return 'danger';
      case 'EXPIRED':
        return 'danger';
      case 'REFINANCED':
        return 'secondary';
      case 'WRITTEN_OFF':
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
      case 'EXPIRED':
        return 'APROBACIÓN VENCIDA';
      case 'REFINANCED':
        return 'REFINANCIADO';
      case 'WRITTEN_OFF':
        return 'CASTIGADO';
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
   * Devuelve la frecuencia abreviada con el tono visual del diseño de listado.
   * @param {Credit['paymentFrequency']} frequency - Frecuencia de pago del crédito.
   * @returns {string} Etiqueta corta para la tabla.
   */
  getFrequencyShortLabel(frequency: Credit['paymentFrequency']): string {
    if (frequency === 'MONTHLY') return 'Mens.';
    if (frequency === 'BIWEEKLY') return 'Quinc.';
    return 'Sem.';
  }

  /**
   * Formatea la columna de cuotas con la frecuencia asociada.
   * @param {Credit} credit - Operación a resumir.
   * @returns {string} Texto combinado para la tabla principal.
   */
  getInstallmentsSummary(credit: Credit): string {
    return `${credit.installmentsCount} × ${this.getFrequencyShortLabel(credit.paymentFrequency)}`;
  }

  /**
   * Convierte la tasa decimal a porcentaje legible para la tabla.
   * @param {number | null} rate - Tasa del backend en formato decimal.
   * @returns {string} Porcentaje visible o N/A.
   */
  getInterestRateLabel(rate: number | null): string {
    if (rate == null) return 'N/A';
    const percent = rate * 100;
    return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
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
      const matchesType =
        !this.selectedType || operation.type === this.selectedType;
      const matchesSeller =
        !this.selectedSeller ||
        (operation.createdByName ?? 'Sin asignar') === this.selectedSeller;

      if (!term) {
        return matchesStatus && matchesType && matchesSeller;
      }

      const normalizedClient = this.normalizeText(operation.customerName);
      const normalizedDni = this.normalizeText(operation.customerDni);

      return (
        matchesStatus &&
        matchesType &&
        matchesSeller &&
        (normalizedClient.includes(term) || normalizedDni.includes(term))
      );
    });
  }

  /**
   * Lista única de vendedores disponibles para el filtro visual del tablero.
   * @returns {{label: string; value: string | null}[]} Opciones ordenadas alfabéticamente.
   */
  get sellerOptions(): { label: string; value: string | null }[] {
    const sellers = Array.from(
      new Set(
        this.operations.map(
          (operation) => operation.createdByName ?? 'Sin asignar',
        ),
      ),
    ).sort((a, b) => a.localeCompare(b));

    return [
      { label: 'Vendedor', value: null },
      ...sellers.map((seller) => ({ label: seller, value: seller })),
    ];
  }

  /**
   * Texto corto para mostrar cantidad total de operaciones cargadas.
   * @returns {string} Resumen legible del volumen actual.
   */
  get operationsCountLabel(): string {
    return `${this.operations.length.toLocaleString('es-AR')} operaciones`;
  }

  /**
   * Limpia todos los filtros activos del listado.
   */
  clearFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = null;
    this.selectedType = null;
    this.selectedSeller = null;
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
