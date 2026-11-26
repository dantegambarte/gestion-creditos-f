import { Injectable } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Observable, map, retry, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';

interface RefreshResponse {
  ok: boolean;
  data: { token: string };
}

/**
 * Servicio que llama a los endpoints de refresh usando HttpBackend directamente,
 * lo que bypasea todos los interceptores y evita dependencias circulares.
 */
@Injectable({ providedIn: 'root' })
export class TokenRefreshService {
  private readonly http: HttpClient;

  constructor(handler: HttpBackend) {
    this.http = new HttpClient(handler);
  }

  /**
   * Renueva el access token interno con la cookie HttpOnly del refresh token.
   * @returns el nuevo access token
   */
  refreshInternal(): Observable<string> {
    return this.refresh('auth/refresh');
  }

  /**
   * Renueva el access token del portal con la cookie HttpOnly del refresh token.
   * @returns el nuevo access token
   */
  refreshPortal(): Observable<string> {
    return this.refresh('auth/portal/refresh');
  }

  /**
   * Llama al endpoint de refresh y reintenta una sola vez si otra pestaña ya
   * rotó el token (401 REFRESH_TOKEN_ROTATED): la cookie vigente es la del ganador.
   * @param path - ruta relativa del endpoint de refresh
   */
  private refresh(path: string): Observable<string> {
    return this.http
      .post<RefreshResponse>(`${environment.apiBaseUrl}/${path}`, {}, { withCredentials: true })
      .pipe(
        retry({
          count: 1,
          delay: (err) =>
            err?.status === 401 && err?.error?.code === 'REFRESH_TOKEN_ROTATED'
              ? timer(0)
              : throwError(() => err),
        }),
        map((res) => res.data.token),
      );
  }
}
