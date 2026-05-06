import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CustomersService } from '../../../../../features/seller/clients/customers.service';
import { ProductsService } from '../../../../../features/seller/products/products.service';
import { ProductUnitsService } from '../../../../../features/seller/products/product-units.service';
import { OperationFormService } from '../../operation-form.service';
import { StepProductsComponent } from './step-products.component';

describe('StepProductsComponent (CR-03)', () => {
  let component: StepProductsComponent;
  let fixture: ComponentFixture<StepProductsComponent>;
  let formService: OperationFormService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepProductsComponent],
      providers: [
        { provide: CustomersService, useValue: { list: () => of([]) } },
        { provide: ProductsService, useValue: { list: () => of([]) } },
        { provide: ProductUnitsService, useValue: { getAll: () => of([]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StepProductsComponent);
    component = fixture.componentInstance;
    formService = fixture.debugElement.injector.get(OperationFormService);
    fixture.detectChanges();
  });

  it('oculta productos y limpia estado al seleccionar préstamo personal', () => {
    formService.searchProduct.set('heladera');
    formService.selectedProducts.set([
      { id: 'p1', name: 'Heladera', price: 1000, stock: 2 },
    ]);

    component.changeOperationType('LOAN');
    fixture.detectChanges();

    expect(component.usesProducts).toBeFalse();
    expect(formService.searchProduct()).toBe('');
    expect(formService.selectedProducts()).toEqual([]);
    expect(
      fixture.nativeElement.querySelector('[data-cy="input-buscar-producto"]'),
    ).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Unidades Disponibles');
  });

  it('filtra productos por nombre al escribir en el buscador (CR-04)', () => {
    formService.availableProducts = [
      {
        id: 'u1',
        name: 'Aire Acondicionado',
        price: 1200,
        stock: 1,
        unitCode: 'AA-001',
      },
      {
        id: 'u2',
        name: 'Heladera',
        price: 900,
        stock: 1,
        unitCode: 'HL-001',
      },
    ];

    formService.searchProduct.set('aire');

    expect(formService.filteredAvailableProducts()).toEqual([
      {
        id: 'u1',
        name: 'Aire Acondicionado',
        price: 1200,
        stock: 1,
        unitCode: 'AA-001',
      },
    ]);
  });

  it('filtra también por código de unidad', () => {
    formService.availableProducts = [
      { id: 'u1', name: 'Aire Acondicionado', price: 1200, stock: 1, unitCode: 'AA-001' },
      { id: 'u2', name: 'Heladera', price: 900, stock: 1, unitCode: 'HL-001' },
    ];

    formService.searchProduct.set('hl-001');

    expect(formService.filteredAvailableProducts()).toEqual([
      { id: 'u2', name: 'Heladera', price: 900, stock: 1, unitCode: 'HL-001' },
    ]);
  });
});
