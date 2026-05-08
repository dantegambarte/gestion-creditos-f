import { Injectable } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
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

  refreshInternal(): Observable<string> {
    return this.http
      .post<RefreshResponse>(
        `${environment.apiBaseUrl}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .pipe(map((res) => res.data.token));
  }

  refreshPortal(): Observable<string> {
    return this.http
      .post<RefreshResponse>(
        `${environment.apiBaseUrl}/auth/portal/refresh`,
        {},
        { withCredentials: true },
      )
      .pipe(map((res) => res.data.token));
  }
}
