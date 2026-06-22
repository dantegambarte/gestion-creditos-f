import { CommonModule, NgClass } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextareaModule } from 'primeng/inputtextarea';
import {
  ClientDetail,
  ContactChannel,
} from '../../../../models/interface/client';

@Component({
  selector: 'app-client-contactar',
  standalone: true,
  imports: [
    CommonModule,
    NgClass,
    FormsModule,
    ButtonModule,
    InputTextareaModule,
  ],
  templateUrl: './client-contactar.component.html',
  styleUrl: './client-contactar.component.scss',
})
export class ClientContactarComponent {
  @Input({ required: true }) client!: ClientDetail;

  channel: ContactChannel = 'WhatsApp';
  message = '';

  get charCount(): number {
    return this.message.length;
  }

  /**
   * Abre WhatsApp con el teléfono del cliente y el texto indicado.
   * Si no se pasa texto, usa un mensaje predefinido con el nombre del cliente.
   * @param text - Mensaje a enviar; opcional.
   */
  openWhatsApp(text?: string): void {
    const phone = this.client.phone.replace(/\D/g, '');
    if (!phone) return;
    const body = text?.trim() || `Hola ${this.client.name}, le contactamos desde finFlow.`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  send(): void {
    if (!this.message.trim()) return;
    if (this.channel === 'WhatsApp') {
      this.openWhatsApp(this.message);
    }
    this.message = '';
  }

  channelDotClass(channel: string): string {
    const map: Record<string, string> = {
      WhatsApp: 'bg-green-500',
      Correo: 'bg-blue-500',
      Llamada: 'bg-yellow-500',
    };
    return map[channel] ?? 'bg-gray-400';
  }

  statusBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      Entregado: 'contact-badge-entregado',
      'Sin respuesta': 'contact-badge-sin-respuesta',
      Fallido: 'contact-badge-fallido',
    };
    return map[estado] ?? '';
  }
}
