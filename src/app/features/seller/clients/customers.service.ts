import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../../core/http/api-http.service';
import {
  Customer,
  CustomerCreatePayload,
  CustomerDetail,
  CustomerDetailRaw,
  CustomerWizardSummary,
  CustomerWizardSummaryRaw,
  CustomerListFilters,
  CustomerRaw,
  CustomerUpdatePayload,
} from '../models/customer.model';

/**
 * Convierte un CustomerRaw (formato del backend) a Customer (formato de la app).
 * @param raw
 * @returns
 */
function toCustomer(raw: CustomerRaw): Customer {
  return {
    id: raw.id,
    fullName: raw.full_name,
    dni: raw.dni,
    address: raw.address,
    phone: raw.phone,
    email: raw.email,
    status: raw.status,
    portalEnabled: raw.portal_enabled,
    createdAt: raw.created_at,
    collectorId: raw.collector_id,
    collectorName: raw.collector_name,
    activeCredits: raw.active_credits,
    delinquency: raw.delinquency,
    paymentCapacity: raw.payment_capacity,
  };
}

/**
 * Convierte un CustomerDetailRaw (formato del backend) a CustomerDetail (formato de la app).
 * @param raw
 * @returns
 */
function toCustomerDetail(raw: CustomerDetailRaw): CustomerDetail {
  return {
    ...toCustomer(raw),
    portalIsTempPassword: raw.portal_is_temp_password,
    portalFailedAttempts: raw.portal_failed_attempts,
    portalLockedAt: raw.portal_locked_at,
    updatedAt: raw.updated_at,
  };
}

/**
 * Convierte el resumen del wizard a formato frontend.
 * @param raw
 * @returns
 */
function toCustomerWizardSummary(raw: CustomerWizardSummaryRaw): CustomerWizardSummary {
  return {
    ...toCustomer(raw),
    delinquency: raw.delinquency,
    paymentCapacity: raw.payment_capacity,
    activeCredits: raw.active_credits,
    paidInstallments: raw.paid_installments,
    pendingInstallments: raw.pending_installments,
    overdueInstallments: raw.overdue_installments,
    credits: raw.credits.map((credit) => ({
      id: credit.id,
      type: credit.type,
      creditName: credit.credit_name,
      totalAmount: credit.total_amount,
      installmentsCount: credit.installments_count,
      status: credit.status,
      referenceDate: credit.reference_date,
    })),
  };
}

/**
 * Convierte un CustomerCreatePayload (formato de la app) a un objeto para el cuerpo de la solicitud HTTP.
 * @param p
 * @returns
 */
function fromCreatePayload(p: CustomerCreatePayload): Record<string, unknown> {
  const body: Record<string, unknown> = {
    full_name: p.fullName,
    dni: p.dni,
  };
  if (p.address) body['address'] = p.address;
  if (p.phone) body['phone'] = p.phone;
  if (p.email) body['email'] = p.email;
  if (p.assignedCollectorId)
    body['assigned_collector_id'] = p.assignedCollectorId;
  return body;
}

/**
 * Convierte un CustomerUpdatePayload (formato de la app) a un objeto para el cuerpo de la solicitud HTTP.
 * @param p
 * @returns
 */
function fromUpdatePayload(p: CustomerUpdatePayload): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (p.fullName !== undefined) body['full_name'] = p.fullName;
  if (p.dni !== undefined) body['dni'] = p.dni;
  if (p.address !== undefined) body['address'] = p.address;
  if (p.phone !== undefined) body['phone'] = p.phone;
  if (p.email !== undefined) body['email'] = p.email;
  if (p.assignedCollectorId !== undefined)
    body['assigned_collector_id'] = p.assignedCollectorId;
  return body;
}

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly api = inject(ApiHttpService);

  /**
   * Lista los clientes según los filtros especificados.
   * @param filters
   * @returns
   */
  list(filters?: CustomerListFilters): Observable<Customer[]> {
    const params: Record<string, string> = {};
    if (filters?.status) params['status'] = filters.status;
    if (filters?.search) params['search'] = filters.search;
    if (filters?.collectorId) params['collector_id'] = filters.collectorId;
    if (filters?.includeSummary !== undefined) {
      params['include_summary'] = String(filters.includeSummary);
    }
    return this.api
      .get<CustomerRaw[]>('customers', params)
      .pipe(map((items) => items.map(toCustomer)));
  }

  /**
   * Obtiene un cliente por su ID.
   * @param id
   * @returns
   */
  getById(id: string): Observable<CustomerDetail> {
    return this.api
      .get<CustomerDetailRaw>(`customers/${id}`)
      .pipe(map(toCustomerDetail));
  }

  /**
   * Obtiene el resumen enriquecido del cliente para el wizard de operaciones.
   * @param id
   * @returns
   */
  getWizardSummary(id: string): Observable<CustomerWizardSummary> {
    return this.api
      .get<CustomerWizardSummaryRaw>(`customers/${id}/wizard-summary`)
      .pipe(map(toCustomerWizardSummary));
  }

  /**
   * Crea un nuevo cliente.
   * @param payload
   * @returns
   */
  create(payload: CustomerCreatePayload): Observable<CustomerDetail> {
    return this.api
      .post<CustomerDetailRaw>('customers', fromCreatePayload(payload))
      .pipe(map(toCustomerDetail));
  }

  /**
   * Actualiza un cliente existente.
   * @param id
   * @param payload
   * @returns
   */
  update(
    id: string,
    payload: CustomerUpdatePayload,
  ): Observable<CustomerDetail> {
    return this.api
      .put<CustomerDetailRaw>(`customers/${id}`, fromUpdatePayload(payload))
      .pipe(map(toCustomerDetail));
  }

  /**
   * Desactiva un cliente existente.
   * @param id
   * @returns
   */
  deactivate(id: string): Observable<void> {
    return this.api
      .patch<void>(`customers/${id}/deactivate`)
      .pipe(map(() => undefined));
  }

  /**
   * Activa un cliente existente.
   * @param id
   * @returns
   */
  activate(id: string): Observable<void> {
    return this.api
      .patch<void>(`customers/${id}/activate`)
      .pipe(map(() => undefined));
  }

  /**
   * Habilita el portal para un cliente existente.
   * @param id
   * @returns
   */
  enablePortal(id: string): Observable<{ tempPassword: string }> {
    return this.api.patch<{ tempPassword: string }>(
      `customers/${id}/enable-portal`,
    );
  }

  /**
   * Deshabilita el portal para un cliente existente.
   * @param id
   * @returns
   */
  disablePortal(id: string): Observable<void> {
    return this.api
      .patch<void>(`customers/${id}/disable-portal`)
      .pipe(map(() => undefined));
  }

  /**
   * Restablece la contraseña del portal para un cliente existente.
   * @param id
   * @returns
   */
  resetPortalPassword(id: string): Observable<{ tempPassword: string }> {
    return this.api.patch<{ tempPassword: string }>(
      `customers/${id}/reset-portal-password`,
    );
  }

  /**
   * Desbloquea el portal para un cliente existente.
   * @param id
   * @returns
   */
  unlockPortal(id: string): Observable<void> {
    return this.api
      .patch<void>(`customers/${id}/unlock-portal`)
      .pipe(map(() => undefined));
  }
}
