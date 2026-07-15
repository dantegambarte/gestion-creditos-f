import { Injectable } from '@angular/core';
import { Message, MessageService } from 'primeng/api';

const DEDUPE_WINDOW_MS = 3000;

/**
 * Extiende MessageService para evitar apilar toasts idénticos (mismo key +
 * severity + summary + detail) mientras el anterior sigue vigente en pantalla.
 * Útil cuando un usuario clickea repetido un botón que dispara el mismo error.
 */
@Injectable()
export class DedupMessageService extends MessageService {
  private lastShownAt = new Map<string, number>();

  override add(message: Message): void {
    const key = this.keyOf(message);
    const now = Date.now();
    const last = this.lastShownAt.get(key);

    if (last !== undefined && now - last < DEDUPE_WINDOW_MS) {
      this.lastShownAt.set(key, now);
      return;
    }

    this.lastShownAt.set(key, now);
    super.add(message);
  }

  /**
   * Agrega múltiples mensajes, evitando duplicados.
   * @param messages
   */
  override addAll(messages: Message[]): void {
    messages.forEach((message) => this.add(message));
  }

  /**
   * Limpia el registro de mensajes mostrados, permitiendo que se muestren nuevamente.
   * @param key
   */
  override clear(key?: string): void {
    this.lastShownAt.clear();
    super.clear(key);
  }

  /**
   * Genera una clave única para un mensaje basada en sus propiedades.
   * @param message
   * @returns
   */
  private keyOf(message: Message): string {
    return `${message.key ?? ''}|${message.severity ?? ''}|${message.summary ?? ''}|${message.detail ?? ''}`;
  }
}
