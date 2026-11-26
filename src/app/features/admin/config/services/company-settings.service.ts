import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiHttpService } from '../../../../core/http/api-http.service';
import {
  CompanyDataPayload,
  CompanyRatesPayload,
  CompanySettings,
} from '../models/interfaces/company-settings.model';

@Injectable({ providedIn: 'root' })
export class CompanySettingsService {
  private readonly api = inject(ApiHttpService);

  /**
   * Obtiene los datos de contacto y las tasas de la empresa (solo ADMIN).
   * @returns Observable con `{ company, rates }`.
   */
  get(): Observable<CompanySettings> {
    return this.api.get<CompanySettings>('company');
  }

  /**
   * Actualiza los datos de contacto de la empresa de forma parcial.
   * @param payload Campos a modificar; `null` o `''` vacían un campo opcional.
   * @returns Observable con `{ company, rates }` actualizados.
   */
  updateCompany(payload: CompanyDataPayload): Observable<CompanySettings> {
    return this.api.put<CompanySettings>('company', payload);
  }

  /**
   * Actualiza las tasas de la empresa; el backend las guarda todas o ninguna.
   * @param payload Tasas como fracciones (0.02 = 2%) y días de gracia.
   * @returns Observable con `{ company, rates }` actualizados.
   */
  updateRates(payload: CompanyRatesPayload): Observable<CompanySettings> {
    return this.api.put<CompanySettings>('company/rates', payload);
  }
}
