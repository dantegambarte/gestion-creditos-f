import { CommonModule, NgClass } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import {
  ClientDetail,
  HistorialEvent,
} from '../../../../models/interface/client';

@Component({
  selector: 'app-client-historial',
  standalone: true,
  imports: [
    CommonModule,
    NgClass,
    FormsModule,
    CalendarModule,
    DropdownModule,
    TableModule,
  ],
  templateUrl: './client-historial.component.html',
  styleUrl: './client-historial.component.scss',
})
export class ClientHistorialComponent {
  @Input({ required: true }) client!: ClientDetail;

  periodoDesde: Date = new Date('2026-01-01');
  periodoHasta: Date = new Date('2026-04-30');
  selectedEvento: string | null = null;

  eventoOptions = [
    { label: 'Todos los eventos', value: null },
    { label: 'Pago recibido', value: 'Pago recibido' },
    { label: 'Mora aplicada', value: 'Mora aplicada' },
    { label: 'Notificación enviada', value: 'Notificación enviada' },
    { label: 'Crédito creado', value: 'Crédito creado' },
    { label: 'Condonación', value: 'Condonación' },
  ];

  get filteredHistorial(): HistorialEvent[] {
    return this.client.historial.filter((e) => {
      return !this.selectedEvento || e.evento === this.selectedEvento;
    });
  }

  get totalJugado(): number {
    return this.client.historial
      .filter((e) => e.evento === 'Pago recibido' && e.monto)
      .reduce((sum, e) => sum + (e.monto ?? 0), 0);
  }

  get ultimoPago(): string {
    const pagos = this.client.historial.filter(
      (e) => e.evento === 'Pago recibido',
    );
    return pagos.length ? pagos[0].fecha : '—';
  }

  get diasMora(): number {
    return this.client.credits
      .filter((c) => c.status === 'OVERDUE')
      .reduce((max, c) => Math.max(max, c.overdueDays ?? 0), 0);
  }

  get movimientos(): number {
    return this.client.historial.length;
  }

  eventoIcon(evento: string): string {
    const map: Record<string, string> = {
      'Pago recibido': 'pi pi-check-circle',
      'Mora aplicada': 'pi pi-exclamation-triangle',
      'Notificación enviada': 'pi pi-bell',
      'Crédito creado': 'pi pi-file',
      Condonación: 'pi pi-percentage',
    };
    return map[evento] ?? 'pi pi-circle';
  }

  eventoClass(evento: string): string {
    const map: Record<string, string> = {
      'Pago recibido': 'ev-pago',
      'Mora aplicada': 'ev-mora',
      'Notificación enviada': 'ev-notif',
      'Crédito creado': 'ev-credito',
      Condonación: 'ev-condon',
    };
    return map[evento] ?? '';
  }

  estadoBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      Aplicado: 'badge-aplicado',
      Pendiente: 'badge-pendiente',
      Enviada: 'badge-enviada',
      Activo: 'badge-activo-h',
      Condonado: 'badge-condonado',
    };
    return map[estado] ?? '';
  }
}
