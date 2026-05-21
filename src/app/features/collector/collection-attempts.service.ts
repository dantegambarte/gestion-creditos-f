import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../core/http/api-http.service';
import {
  CollectionAttempt,
  CollectionAttemptCreatePayload,
  CollectionAttemptRaw,
} from './models/collection-attempt.model';

/**
 * Convierte la representación cruda del backend a la forma estructurada del frontend.
 */
function toAttempt(raw: CollectionAttemptRaw): CollectionAttempt {
  return {
    id: raw.id,
    installmentId: raw.installment_id,
    collectorId: raw.collector_id,
    createdBy: raw.created_by,
    attemptType: raw.attempt_type,
    reason: raw.reason,
    nextVisitDate: raw.next_visit_date,
    notes: raw.notes,
    createdAt: raw.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class CollectionAttemptsService {
  private readonly api = inject(ApiHttpService);

  /**
   * Registra un intento de cobranza sin cobro (NO_PAYMENT o NOT_FOUND).
   * Para NO_PAYMENT el backend exige `reason` y `nextVisitDate`.
   * Para NOT_FOUND ambos campos son ignorados.
   */
  create(payload: CollectionAttemptCreatePayload): Observable<CollectionAttempt> {
    const body: Record<string, unknown> = {
      installment_id: payload.installmentId,
      attempt_type: payload.attemptType,
    };
    if (payload.reason) body['reason'] = payload.reason;
    if (payload.nextVisitDate) body['next_visit_date'] = payload.nextVisitDate;
    if (payload.notes) body['notes'] = payload.notes;
    return this.api
      .post<CollectionAttemptRaw>('collection-attempts', body)
      .pipe(map(toAttempt));
  }
}
