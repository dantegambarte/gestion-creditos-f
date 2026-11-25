/**
 * Clave de idempotencia por intento de cobro (`client_request_id`, contrato P08
 * del backend en POST /payments). Un reintento del mismo cobro (timeout, doble
 * toque) reusa la clave y el backend devuelve la pre-carga existente en vez de
 * crear otra. Si cambian los datos del cobro, o se llama a `reset()` tras un
 * cobro exitoso / al abrir un diálogo nuevo, se genera una clave nueva para no
 * chocar con `409 IDEMPOTENCY_KEY_REUSED`.
 */
export class PaymentAttemptKey {
  private key: string | null = null;
  private fingerprint: string | null = null;

  /**
   * Devuelve la clave del intento actual, generando una nueva si no hay o si los
   * datos del cobro cambiaron respecto del último intento.
   * @param attempt - Datos del cobro que identifican el intento (cuota, montos, medio).
   * @returns UUID v4 a enviar como `client_request_id`.
   */
  forAttempt(attempt: unknown): string {
    const fp = JSON.stringify(attempt);
    if (!this.key || fp !== this.fingerprint) {
      this.key = generateUuidV4();
      this.fingerprint = fp;
    }
    return this.key;
  }

  /** Descarta la clave actual: el próximo intento es un cobro nuevo. */
  reset(): void {
    this.key = null;
    this.fingerprint = null;
  }
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
