import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ClientOperation } from '../../../../models/interface/client';

@Component({
  selector: 'app-step-client',
  standalone: true,
  imports: [FormsModule, InputTextModule],
  templateUrl: './step-client.component.html',
})
export class StepClientComponent {
  @Input() clients: ClientOperation[] = [];
  @Input() selectedClientId: string | null = null;
  @Output() clientSelected = new EventEmitter<ClientOperation>();

  searchText = '';

  /**
   * Devuelve los clientes filtrados por nombre o DNI según el texto de búsqueda local.
   * La comparación ignora mayúsculas, minúsculas y tildes para evitar falsos negativos.
   */
  get filteredClients(): ClientOperation[] {
    const term = this.normalizeText(this.searchText);
    if (!term) return this.clients;
    return this.clients.filter(
      (c) =>
        this.normalizeText(c.name).includes(term) ||
        this.normalizeText(c.dni).includes(term),
    );
  }

  /**
   * Indica si el cliente seleccionado está activo para validar el avance del paso.
   */
  get isSelectedClientInactive(): boolean {
    if (!this.selectedClientId) return false;
    const client = this.clients.find((c) => c.id === this.selectedClientId);
    return client?.status !== 'ACTIVE';
  }

  /**
   * Normaliza texto para búsquedas tolerantes a tildes y diferencias de casing.
   * @param {string | null | undefined} value - Texto a normalizar.
   * @returns {string} Texto normalizado listo para comparar.
   */
  private normalizeText(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
