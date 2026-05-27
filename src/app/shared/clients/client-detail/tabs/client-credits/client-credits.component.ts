import { CommonModule, NgClass } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ClientDetail } from '../../../../models/interface/client';
import { Credit } from '../../../../models/interface/credit';
import { AppRoutes } from '../../../../models/enums/routes.enum';

@Component({
  selector: 'app-client-credits',
  standalone: true,
  imports: [
    CommonModule,
    NgClass,
    FormsModule,
    ButtonModule,
    DropdownModule,
    InputTextModule,
  ],
  templateUrl: './client-credits.component.html',
  styleUrl: './client-credits.component.scss',
})
export class ClientCreditsComponent {
  @Input({ required: true }) client!: ClientDetail;
  @Input() base = '';

  searchTerm = '';
  selectedEstado: string | null = null;

  estadoOptions = [
    { label: 'Todos los estados', value: null },
    { label: 'Activo', value: 'ACTIVE' },
    { label: 'En Mora', value: 'OVERDUE' },
    { label: 'Pagado', value: 'PAID' },
  ];

  constructor(private router: Router) {}

  get filteredCredits(): Credit[] {
    return this.client.credits.filter((c) => {
      const matchesSearch =
        !this.searchTerm ||
        c.id.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        c.product.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesEstado =
        !this.selectedEstado || c.status === this.selectedEstado;
      return matchesSearch && matchesEstado;
    });
  }

  navigateToNew(): void {
    this.router.navigate([`${this.base}/${AppRoutes.OPERATIONS_NEW}`], {
      queryParams: { clientDni: this.client.dni },
    });
  }
}
