import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { CompanyConfigComponent } from './company-config.component';

const settings = {
  company: {
    system_name: 'Productcred',
    contact_email: 'admin@example.test',
    phone: '381 0000000',
    address: 'Calle 1',
  },
  rates: {
    sale_rate_monthly: 0.02,
    loan_rate_monthly: 0.025,
    mora_rate_daily: 0.001,
    seller_commission_rate: 0.05,
    grace_period_days: 3,
  },
};

describe('CompanyConfigComponent', () => {
  let http: HttpTestingController;
  let msg: jasmine.SpyObj<MessageService>;

  /** Crea el componente y responde la carga inicial de `GET /company`. */
  function setup() {
    msg = jasmine.createSpyObj('MessageService', ['add']);
    TestBed.configureTestingModule({
      imports: [CompanyConfigComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: MessageService, useValue: msg },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CompanyConfigComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('carga datos y tasas reales desde GET /company y muestra porcentajes', () => {
    const cmp = setup().componentInstance;
    const req = http.expectOne((r) => r.url.endsWith('/company'));
    expect(req.request.method).toBe('GET');
    req.flush({ ok: true, data: settings });
    expect(cmp.systemName).toBe('Productcred');
    expect(cmp.saleRate).toBe(2);
    expect(cmp.moraRate).toBe(0.1);
    expect(cmp.gracePeriod).toBe(3);
  });

  it('guardar llama a PUT /company y PUT /company/rates con fracciones y avisa éxito', () => {
    const cmp = setup().componentInstance;
    http.expectOne((r) => r.url.endsWith('/company')).flush({ ok: true, data: settings });
    cmp.systemName = 'Nuevo nombre';
    cmp.sellerCommission = 7;
    cmp.save();

    const companyReq = http.expectOne((r) => r.url.endsWith('/company') && r.method === 'PUT');
    expect(companyReq.request.body.system_name).toBe('Nuevo nombre');
    expect(msg.add).not.toHaveBeenCalled();
    companyReq.flush({ ok: true, data: settings });

    const ratesReq = http.expectOne((r) => r.url.endsWith('/company/rates'));
    expect(ratesReq.request.method).toBe('PUT');
    expect(ratesReq.request.body).toEqual({
      sale_rate_monthly: 0.02,
      loan_rate_monthly: 0.025,
      mora_rate_daily: 0.001,
      seller_commission_rate: 0.07,
      grace_period_days: 3,
    });
    ratesReq.flush({ ok: true, data: settings });
    expect(msg.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
  });

  it('si el backend rechaza el guardado muestra error y nunca éxito', () => {
    const cmp = setup().componentInstance;
    http.expectOne((r) => r.url.endsWith('/company')).flush({ ok: true, data: settings });
    cmp.save();
    http
      .expectOne((r) => r.url.endsWith('/company') && r.method === 'PUT')
      .flush(
        { ok: false, message: 'El email de contacto no es válido.' },
        { status: 400, statusText: 'Bad Request' },
      );
    expect(msg.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
    expect(msg.add).not.toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
    expect(cmp.saving).toBeFalse();
  });

  it('si falla la carga bloquea el guardado', () => {
    const fixture = setup();
    http
      .expectOne((r) => r.url.endsWith('/company'))
      .flush({ ok: false, message: 'x' }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-cy="company-config-load-error"]')).not.toBeNull();
    fixture.componentInstance.save();
    http.expectNone((r) => r.method === 'PUT');
  });
});
