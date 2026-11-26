import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Guarda los access tokens (interno y portal) sólo en memoria (#39).
 * Nunca se escriben en localStorage/sessionStorage: al recargar la página
 * se recuperan con el refresh token de la cookie HttpOnly.
 */
@Injectable({ providedIn: 'root' })
export class AccessTokenStore {
  private internalToken: string | null = null;
  private portalToken: string | null = null;

  /**
   * Devuelve el access token vigente del contexto indicado.
   * @param isPortal - true para el portal del cliente, false para el sistema interno
   */
  get(isPortal: boolean): string | null {
    return isPortal ? this.portalToken : this.internalToken;
  }

  /**
   * Reemplaza el access token del contexto indicado.
   * @param isPortal - true para el portal del cliente, false para el sistema interno
   * @param token - nuevo token, o null para descartarlo
   */
  set(isPortal: boolean, token: string | null): void {
    if (isPortal) this.portalToken = token;
    else this.internalToken = token;
  }

  /**
   * Borra de localStorage los tokens que versiones anteriores dejaban persistidos.
   */
  removeLegacyTokens(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(environment.tokenKey);
    localStorage.removeItem(environment.portalTokenKey);
  }
}

/**
 * Indica si un error HTTP significa que el backend rechazó la sesión (401/403),
 * a diferencia de un corte de red o un 5xx, que no deben cerrarla.
 * @param err - error devuelto por HttpClient
 * @returns true sólo para 401 o 403
 */
export function isSessionRejected(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return status === 401 || status === 403;
}
