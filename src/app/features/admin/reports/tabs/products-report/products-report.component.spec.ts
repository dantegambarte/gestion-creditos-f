import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ProductsReportComponent } from './products-report.component';

/** Fila cruda de `GET /reports/products` con el stock disponible indicado. */
function rawRow(id: string, available: number) {
  return {
    id,
    title: `Producto ${id}`,
    description: '',
    status: 'ACTIVE',
    min_price: 1000,
    max_price: 1000,
    available_count: available,
    times_sold: 0,
    total_revenue: 0,
    avg_selling_price: 0,
  };
}

/** `GET /company` con el umbral indicado; `undefined` simula que el backend no lo envía. */
function companyWith(lowStockThreshold?: number) {
  return {
    company: { system_name: 'Empresa', contact_email: null, phone: null, address: null },
    rates: {
      sale_rate_monthly: null,
      loan_rate_monthly: null,
      mora_rate_daily: null,
      seller_commission_rate: null,
      grace_period_days: null,
    },
    ...(lowStockThreshold === undefined ? {} : { low_stock_threshold: lowStockThreshold }),
  };
}

const ROWS = [rawRow('a', 2), rawRow('b', 4), rawRow('c', 0), rawRow('d', 9)];

describe('ProductsReportComponent — umbral de stock bajo', () => {
  let http: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      imports: [ProductsReportComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ProductsReportComponent);
    fixture.detectChanges();
    return fixture;
  }

  /** Responde la carga inicial: la config de empresa (o un error) y el reporte. */
  function flushInitial(company: object | 'error') {
    const companyReq = http.expectOne((r) => r.url.endsWith('/company'));
    if (company === 'error') {
      companyReq.flush({ ok: false, error: 'boom' }, { status: 500, statusText: 'Server Error' });
    } else {
      companyReq.flush({ ok: true, data: company });
    }
    http.expectOne((r) => r.url.endsWith('/reports/products')).flush({ ok: true, data: ROWS });
  }

  /** Textos de los badges "Stock bajo" de la tabla de escritorio. */
  function lowStockBadges(el: HTMLElement): string[] {
    return Array.from(el.querySelectorAll('td span'))
      .map((s) => (s.textContent ?? '').trim())
      .filter((t) => t.startsWith('Stock bajo'));
  }

  afterEach(() => http.verify());

  it('usa el umbral de la configuración del backend en el filtro y los badges (umbral 3)', () => {
    const fixture = setup();
    const cmp = fixture.componentInstance;
    flushInitial(companyWith(3));
    fixture.detectChanges();

    cmp.stockMode = 'LOW';
    expect(cmp.filteredProductRows.map((r) => r.id)).toEqual(['a']);

    cmp.stockMode = 'ALL';
    fixture.detectChanges();
    expect(lowStockBadges(fixture.nativeElement)).toEqual(['Stock bajo (2)']);
  });

  it('usa 5 si la configuración no trae umbral', () => {
    const fixture = setup();
    const cmp = fixture.componentInstance;
    flushInitial(companyWith(undefined));
    fixture.detectChanges();

    cmp.stockMode = 'LOW';
    expect(cmp.filteredProductRows.map((r) => r.id)).toEqual(['a', 'b']);

    cmp.stockMode = 'ALL';
    fixture.detectChanges();
    expect(lowStockBadges(fixture.nativeElement)).toEqual(['Stock bajo (2)', 'Stock bajo (4)']);
  });

  it('usa 5 y muestra el reporte igual si falla la consulta de configuración', () => {
    const fixture = setup();
    const cmp = fixture.componentInstance;
    flushInitial('error');
    fixture.detectChanges();

    expect(cmp.error).toBeNull();
    expect(cmp.productRows.length).toBe(4);
    cmp.stockMode = 'LOW';
    expect(cmp.filteredProductRows.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('el umbral que carga el admin en pantalla pisa al de la configuración', () => {
    const fixture = setup();
    const cmp = fixture.componentInstance;
    flushInitial(companyWith(3));
    cmp.stockThreshold = 8;
    fixture.detectChanges();

    cmp.stockMode = 'LOW';
    expect(cmp.filteredProductRows.map((r) => r.id)).toEqual(['a', 'b']);
    cmp.stockMode = 'ALL';
    fixture.detectChanges();
    expect(lowStockBadges(fixture.nativeElement)).toEqual(['Stock bajo (2)', 'Stock bajo (4)']);
  });

  it('"Sin stock" no cuenta como stock bajo', () => {
    const fixture = setup();
    const cmp = fixture.componentInstance;
    flushInitial(companyWith(3));
    cmp.stockMode = 'LOW';
    expect(cmp.filteredProductRows.some((r) => r.availableCount === 0)).toBeFalse();
  });
});
