import { Component, OnInit, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { concatMap } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { CompanySettingsService } from '../services/company-settings.service';
import { CompanySettings } from '../models/interfaces/company-settings.model';

/**
 * Convierte una fracción del backend (0.02) a porcentaje para mostrar (2).
 * @returns null si el backend no tiene valor.
 */
function toPercent(value: number | null): number | null {
  return value === null || value === undefined ? null : Math.round(value * 100 * 1e6) / 1e6;
}

/**
 * Convierte un porcentaje cargado por el usuario (2) a fracción para el backend (0.02).
 * @returns undefined si el campo quedó vacío, para no enviarlo.
 */
function toFraction(value: number | null): number | undefined {
  return value === null || value === undefined ? undefined : Math.round((value / 100) * 1e8) / 1e8;
}

@Component({
  selector: 'app-company-config',
  imports: [FormsModule, InputTextModule, InputNumberModule, ButtonModule],
  templateUrl: './company-config.component.html',
})
export class CompanyConfigComponent implements OnInit {
  private readonly msg = inject(MessageService);
  private readonly svc = inject(CompanySettingsService);

  loading = false;
  saving = false;
  loadError: string | null = null;

  systemName = '';
  contactEmail = '';
  phone = '';
  address = '';

  saleRate: number | null = null;
  loanRate: number | null = null;
  moraRate: number | null = null;
  sellerCommission: number | null = null;
  gracePeriod: number | null = null;

  /** Carga los datos reales de la empresa al iniciar. */
  ngOnInit(): void {
    this.load();
  }

  /** Pide al backend los datos y tasas de la empresa y los vuelca en el formulario. */
  load(): void {
    this.loading = true;
    this.loadError = null;
    this.svc.get().subscribe({
      next: (data) => {
        this.apply(data);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.loadError = err?.message || 'No se pudo cargar la configuración de la empresa.';
      },
    });
  }

  /**
   * Guarda datos y tasas en el servidor (primero datos, luego tasas) y solo
   * muestra éxito cuando ambas respuestas llegaron bien.
   */
  save(): void {
    if (this.saving || this.loading || this.loadError) return;
    if (!this.systemName.trim()) {
      this.msg.add({
        severity: 'warn',
        summary: 'Datos incompletos',
        detail: 'El nombre del sistema no puede quedar vacío.',
        life: 5000,
      });
      return;
    }
    this.saving = true;
    const rates = {
      sale_rate_monthly: toFraction(this.saleRate),
      loan_rate_monthly: toFraction(this.loanRate),
      mora_rate_daily: toFraction(this.moraRate),
      seller_commission_rate: toFraction(this.sellerCommission),
      grace_period_days: this.gracePeriod ?? undefined,
    };
    const ratesPayload = Object.fromEntries(
      Object.entries(rates).filter(([, v]) => v !== undefined),
    );
    this.svc
      .updateCompany({
        system_name: this.systemName.trim(),
        contact_email: this.contactEmail.trim() || null,
        phone: this.phone.trim() || null,
        address: this.address.trim() || null,
      })
      .pipe(concatMap(() => this.svc.updateRates(ratesPayload)))
      .subscribe({
        next: (data) => {
          this.apply(data);
          this.saving = false;
          this.msg.add({
            severity: 'success',
            summary: 'Cambios guardados',
            detail: 'La configuración de la empresa se guardó correctamente.',
            life: 4000,
          });
        },
        error: (err) => {
          this.saving = false;
          this.msg.add({
            severity: 'error',
            summary: 'No se guardaron los cambios',
            detail: err?.message || 'Error al guardar la configuración de la empresa.',
            life: 6000,
          });
        },
      });
  }

  /**
   * Vuelca la respuesta del backend en los campos del formulario.
   * @param data Respuesta `{ company, rates }` del backend.
   */
  private apply(data: CompanySettings): void {
    const { company, rates } = data;
    this.systemName = company?.system_name ?? '';
    this.contactEmail = company?.contact_email ?? '';
    this.phone = company?.phone ?? '';
    this.address = company?.address ?? '';
    this.saleRate = toPercent(rates?.sale_rate_monthly ?? null);
    this.loanRate = toPercent(rates?.loan_rate_monthly ?? null);
    this.moraRate = toPercent(rates?.mora_rate_daily ?? null);
    this.sellerCommission = toPercent(rates?.seller_commission_rate ?? null);
    this.gracePeriod = rates?.grace_period_days ?? null;
  }
}
