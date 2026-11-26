import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { RouteComponent } from './route.component';

/**
 * Construye una planilla raw mínima como la devuelve el backend.
 * @param id - identificador de la planilla
 * @param sheetDate - fecha de la planilla (yyyy-mm-dd)
 * @param createdAt - instante de generación ISO
 */
function sheetRaw(id: string, sheetDate: string, createdAt: string) {
  return {
    id,
    sheet_date: sheetDate,
    filter_used: 'ALL',
    status: 'ACTIVE',
    created_at: createdAt,
    sent_at: null,
    collector_id: 'col1',
    collector_name: 'Cobrador',
    total_items: 3,
  };
}

/**
 * Construye un cobro raw mínimo como lo devuelve el backend.
 * @param overrides - campos raw a pisar
 */
function paymentRaw(overrides: Record<string, unknown>) {
  return {
    id: 'pay',
    installment_id: 'i1',
    amount_received: 0,
    amount_cash: 0,
    amount_transfer: 0,
    payment_method: 'CASH',
    status: 'APPROVED',
    created_at: '2026-11-26T12:00:00Z',
    is_reversal: false,
    reversal_payment_id: null,
    ...overrides,
  };
}

describe('RouteComponent', () => {
  let component: RouteComponent;
  let fixture: ComponentFixture<RouteComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouteComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RouteComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  /**
   * Responde la carga de planillas y, si el componente pide cobros, también esa.
   * @param sheets - planillas raw
   * @param payments - cobros raw
   * @returns created_from enviado en la carga de cobros (null si no se pidieron)
   */
  function respond(sheets: unknown[], payments: unknown[]): string | null {
    httpMock
      .expectOne((r) => r.method === 'GET' && /\/collections$/.test(r.url))
      .flush({ ok: true, data: sheets });
    const reqs = httpMock.match((r) => r.method === 'GET' && /\/payments$/.test(r.url));
    if (reqs.length === 0) return null;
    expect(reqs.length).toBe(1);
    reqs[0].flush({ ok: true, data: payments });
    return reqs[0].request.params.get('created_from');
  }

  /**
   * Fecha local (yyyy-mm-dd) de un instante ISO, como la calcula DateService.
   * @param iso - instante ISO
   * @returns fecha local
   */
  function localDay(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  it('pide los cobros filtrados en backend desde el día de la planilla más antigua del día', () => {
    const createdFrom = respond(
      [
        sheetRaw('regenerada', '2026-11-26', '2026-11-26T10:00:00Z'),
        sheetRaw('primera', '2026-11-26', '2026-11-26T08:00:00Z'),
      ],
      [],
    );

    expect(createdFrom).toBe(localDay('2026-11-26T08:00:00Z'));
    expect(component.loadingPayments).toBeFalse();
  });

  it('sin planillas no pide cobros (no descarga todos los pagos)', () => {
    expect(respond([], [])).toBeNull();
    expect(component.recentPayments).toEqual([]);
    expect(component.loadingPayments).toBeFalse();
  });

  it('muestra solo la última planilla generada', () => {
    respond(
      [
        sheetRaw('vieja', '2026-11-25', '2026-11-25T08:00:00Z'),
        sheetRaw('nueva', '2026-11-26', '2026-11-26T08:00:00Z'),
      ],
      [],
    );

    expect(component.currentSheet?.id).toBe('nueva');
    expect(component.currentSheetList.length).toBe(1);
    expect(component.loadingSheets).toBeFalse();
  });

  it('suma la recaudación desde la planilla más antigua del día, sin reversiones, revertidos ni rechazados', () => {
    respond(
      [
        sheetRaw('regenerada', '2026-11-26', '2026-11-26T10:00:00Z'),
        sheetRaw('primera', '2026-11-26', '2026-11-26T08:00:00Z'),
      ],
      [
        paymentRaw({ id: 'antes', amount_cash: 999, created_at: '2026-11-26T07:00:00Z' }),
        paymentRaw({ id: 'ok-cash', amount_cash: 1000, created_at: '2026-11-26T09:00:00Z' }),
        paymentRaw({
          id: 'ok-mixto',
          amount_cash: 500,
          amount_transfer: 2000,
          status: 'PENDING',
          created_at: '2026-11-26T11:00:00Z',
        }),
        paymentRaw({
          id: 'reversion',
          amount_cash: -1000,
          is_reversal: true,
          created_at: '2026-11-26T11:30:00Z',
        }),
        paymentRaw({
          id: 'revertido',
          amount_cash: 700,
          reversal_payment_id: 'x',
          created_at: '2026-11-26T11:40:00Z',
        }),
        paymentRaw({
          id: 'rechazado',
          amount_transfer: 300,
          status: 'REJECTED',
          created_at: '2026-11-26T11:50:00Z',
        }),
      ],
    );

    expect(component.dailyCollection).toEqual({ total: 3500, cash: 1500, transfer: 2000 });
  });

  it('sin planillas no hay ventana de recaudación', () => {
    respond([], [paymentRaw({ amount_cash: 1000 })]);

    expect(component.currentSheet).toBeNull();
    expect(component.dailyCollection.total).toBe(0);
  });

  it('guarda el error si falla la carga de planillas', () => {
    httpMock
      .expectOne((r) => /\/collections$/.test(r.url))
      .flush({ message: 'boom' }, { status: 500, statusText: 'Error' });
    httpMock.expectNone((r) => /\/payments$/.test(r.url));

    expect(component.errorSheets).not.toBeNull();
    expect(component.loadingPayments).toBeFalse();
    expect(component.loadingSheets).toBeFalse();
  });
});
