import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';

const REQUEST_TIMEOUT_MS = 30_000;
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response';
import { toAppError } from '../models/app-error';

@Injectable({ providedIn: 'root' })
export class ApiHttpService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /**
   * Realiza una petición GET al endpoint indicado.
   * @param path Ruta relativa del endpoint (ej: `'usuarios/1'`).
   * @param params Parámetros de query opcionales (se omiten los vacíos/nulos).
   * @returns Observable con el dato tipado `T` extraído de la respuesta.
   */
  get<T>(
    path: string,
    params?: Record<string, string | number | boolean>,
  ): Observable<T> {
    const httpParams = params ? this.buildParams(params) : undefined;
    return this.http
      .get<ApiResponse<T>>(this.url(path), { params: httpParams })
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        map(this.unwrap<T>()),
        catchError((err) => throwError(() => toAppError(err))),
      );
  }

  /**
   * Realiza una petición POST al endpoint indicado.
   * @param path Ruta relativa del endpoint.
   * @param body Cuerpo de la petición (se serializa como JSON).
   * @returns Observable con el dato tipado `T` extraído de la respuesta.
   */
  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<ApiResponse<T>>(this.url(path), body).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map(this.unwrap<T>()),
      catchError((err) => throwError(() => toAppError(err))),
    );
  }

  /**
   * Realiza una petición PUT al endpoint indicado (reemplazo completo del recurso).
   * @param path Ruta relativa del endpoint.
   * @param body Cuerpo de la petición con el recurso completo.
   * @returns Observable con el dato tipado `T` extraído de la respuesta.
   */
  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http.put<ApiResponse<T>>(this.url(path), body).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map(this.unwrap<T>()),
      catchError((err) => throwError(() => toAppError(err))),
    );
  }

  /**
   * Realiza una petición PATCH al endpoint indicado (actualización parcial del recurso).
   * @param path Ruta relativa del endpoint.
   * @param body Cuerpo de la petición con los campos a actualizar.
   * @returns Observable con el dato tipado `T` extraído de la respuesta.
   */
  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http.patch<ApiResponse<T>>(this.url(path), body).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map(this.unwrap<T>()),
      catchError((err) => throwError(() => toAppError(err))),
    );
  }

  /**
   * Realiza una petición DELETE al endpoint indicado.
   * @param path Ruta relativa del endpoint del recurso a eliminar.
   * @returns Observable con el dato tipado `T` extraído de la respuesta.
   */
  delete<T>(path: string): Observable<T> {
    return this.http.delete<ApiResponse<T>>(this.url(path)).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map(this.unwrap<T>()),
      catchError((err) => throwError(() => toAppError(err))),
    );
  }

  /**
   * Construye la URL completa concatenando la base con la ruta dada.
   * Elimina la barra inicial de `path` para evitar doble separador.
   */
  private url(path: string): string {
    return `${this.base}/${path.replace(/^\//, '')}`;
  }

  /**
   * Devuelve una función que extrae `data` de la respuesta envuelta `ApiResponse<T>`.
   * Lanza un error con el mensaje del servidor si `ok` es falso.
   */
  private unwrap<T>(): (res: ApiResponse<T>) => T {
    return (res) => {
      if (!res.ok) {
        throw { status: 400, message: res.message, errors: res.errors };
      }
      return res.data as T;
    };
  }

  /**
   * Convierte un objeto plano de parámetros en `HttpParams`.
   * Omite entradas cuyo valor sea `undefined`, `null` o cadena vacía.
   */
  private buildParams(
    params: Record<string, string | number | boolean>,
  ): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        p = p.set(k, String(v));
      }
    }
    return p;
  }
}
