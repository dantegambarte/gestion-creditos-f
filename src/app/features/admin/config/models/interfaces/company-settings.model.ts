/** Datos de contacto de la empresa (`GET/PUT /api/company`). */
export interface CompanyData {
  system_name: string;
  contact_email: string | null;
  phone: string | null;
  address: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
}

/** Tasas de la empresa como fracciones (0.02 = 2%), `grace_period_days` en días. */
export interface CompanyRates {
  sale_rate_monthly: number | null;
  loan_rate_monthly: number | null;
  mora_rate_daily: number | null;
  seller_commission_rate: number | null;
  grace_period_days: number | null;
}

/** Respuesta común de los endpoints de empresa. */
export interface CompanySettings {
  company: CompanyData;
  rates: CompanyRates;
}

/** Cuerpo de `PUT /api/company` (parcial). */
export type CompanyDataPayload = Partial<
  Pick<CompanyData, 'system_name' | 'contact_email' | 'phone' | 'address'>
>;

/** Cuerpo de `PUT /api/company/rates` (parcial, atómico). */
export type CompanyRatesPayload = Partial<{ [K in keyof CompanyRates]: number }>;
