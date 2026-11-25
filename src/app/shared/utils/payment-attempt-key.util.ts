import { Injectable } from '@angular/core';

/**
 * Datos que identifican un intento de cobro. Son exactamente los que compara el
 * backend (P08, `_resolveIdempotentReplay`) para aceptar un reintento: cuota,
 * tipo de generación y monto total. Notas, medio y reparto efectivo/transferencia
 * NO cuentan: si cambian tras un timeout, el backend devuelve la pre-carga
 * original y no crea otra.
 */
export interface PaymentAttempt {
  installmentId: string;
  amount: number;
  generationType?: 'RENEWAL';
}

/**
 * Claves de idempotencia por intento de cobro (`client_request_id`, POST
 * /payments). Es un servicio root para que la clave pendiente sobreviva al
 * cierre y reapertura del diálogo: un cobro sin respuesta confirmada (timeout,
 * 5xx, red) reusa su clave en cualquier reintento hasta que se confirma con
 * `settle()`. Vive en memoria: una recarga de página la pierde.
 */
@Injectable({ providedIn: 'root' })
export class PaymentAttemptKeys {
  private readonly pending = new Map<string, string>();

  /**
   * Devuelve la clave pendiente del intento o genera una nueva.
   * @param attempt - Cuota, monto total y tipo del cobro.
   * @returns UUID v4 a enviar como `client_request_id`.
   */
  keyFor(attempt: PaymentAttempt): string {
    const fp = fingerprint(attempt);
    let key = this.pending.get(fp);
    if (!key) {
      key = generateUuidV4();
      this.pending.set(fp, key);
    }
    return key;
  }

  /**
   * Descarta la clave del intento tras un cobro confirmado por el backend: el
   * próximo cobro de la misma cuota y monto es un cobro nuevo.
   */
  settle(attempt: PaymentAttempt): void {
    this.pending.delete(fingerprint(attempt));
  }
}

/** Huella estable del intento: monto a centavos, como redondea el backend. */
function fingerprint(a: PaymentAttempt): string {
  return `${a.installmentId.toLowerCase()}|${a.generationType ?? 'COLLECTION'}|${Math.round(a.amount * 100)}`;
}

/**
 * Genera un UUID v4. Usa `crypto.randomUUID` si existe; si no (contexto no
 * seguro, p. ej. la PWA servida por IP en la red local), lo arma con
 * `crypto.getRandomValues`, que sí está disponible fuera de HTTPS.
 * @returns UUID v4 en minúsculas.
 */
function generateUuidV4(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
