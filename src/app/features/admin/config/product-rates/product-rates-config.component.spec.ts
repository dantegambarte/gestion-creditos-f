import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { ProductRatesConfigComponent } from './product-rates-config.component';
import { ProductRatesService } from '../services/product-rates.service';
import { ProductsService } from '../../../seller/products/products.service';

describe('ProductRatesConfigComponent executeToggle', () => {
  let component: ProductRatesConfigComponent;
  let svc: jasmine.SpyObj<ProductRatesService>;
  let msg: jasmine.SpyObj<MessageService>;

  beforeEach(() => {
    svc = jasmine.createSpyObj('ProductRatesService', ['activate', 'deactivate']);
    msg = jasmine.createSpyObj('MessageService', ['add']);
    TestBed.configureTestingModule({
      imports: [ProductRatesConfigComponent],
      providers: [
        { provide: ProductRatesService, useValue: svc },
        { provide: ProductsService, useValue: {} },
        { provide: MessageService, useValue: msg },
      ],
    });
    component = TestBed.createComponent(ProductRatesConfigComponent).componentInstance;
  });

  it('activar con respuesta vacía deja la tarifa activa', () => {
    const rate = { id: 'r1', active: false } as any;
    component.allRates = [rate];
    svc.activate.and.returnValue(of(undefined as any));
    const addSpy = spyOn((component as any).msg, 'add');
    (component as any).executeToggle(rate);
    expect(component.allRates[0].active).toBeTrue();
    expect(addSpy).toHaveBeenCalledWith(jasmine.objectContaining({ detail: 'Tasa activada.' }));
  });

  it('desactivar con respuesta vacía deja la tarifa inactiva', () => {
    const rate = { id: 'r1', active: true } as any;
    component.allRates = [rate];
    svc.deactivate.and.returnValue(of(undefined as any));
    (component as any).executeToggle(rate);
    expect(component.allRates[0].active).toBeFalse();
  });
});
