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
   */
  get filteredClients(): ClientOperation[] {
    const term = this.searchText.trim().toLowerCase();
    if (!term) return this.clients;
    return this.clients.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.dni.toLowerCase().includes(term),
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
}
