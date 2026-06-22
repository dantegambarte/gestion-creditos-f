import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AutoComplete } from 'primeng/autocomplete';
import { of, throwError } from 'rxjs';

import { ApiHttpService } from '../../core/http/api-http.service';
import { HeaderService } from '../../core/services/header.service';
import { SimulatorComponent, SimulateProduct } from './simulator.component';

const MOCK_OPTIONS = {
  WEEKLY: [4, 8],
  MONTHLY: [6, 12],
};

const MOCK_RESULTS = [
  {
    type: 'LOAN',
    payment_frequency: 'MONTHLY',
    installments_count: 12,
    total_amount: 100000,
    installment_amount: 12000,
    total_to_return: 144000,
    financed_amount: 100000,
    down_payment: 0,
    rate: 0.44,
    note: '',
    items: [],
  },
  {
    type: 'LOAN',
    payment_frequency: 'WEEKLY',
    installments_count: 8,
    total_amount: 100000,
    installment_amount: 15000,
    total_to_return: 120000,
    financed_amount: 100000,
    down_payment: 0,
    rate: 0.2,
    note: '',
    items: [],
  },
];

const MANY_MONTHLY_RESULTS = [3, 6, 9, 12].map((installments) => ({
  type: 'LOAN',
  payment_frequency: 'MONTHLY',
  installments_count: installments,
  total_amount: 100000,
  installment_amount: 100000 / installments,
  total_to_return: 130000,
  financed_amount: 100000,
  down_payment: 0,
  rate: 0.3,
  note: '',
  items: [],
}));

const MOCK_PRODUCT: SimulateProduct = {
  id: 'prod-1',
  title: 'Celular Samsung Galaxy A54',
  variants: [
    {
      id: 'var-1',
      color: 'Negro',
      size: null,
      capacity: '128GB',
      currentPrice: 250000,
      label: 'Negro / 128GB',
    },
  ],
};

const VISUAL_STRESS_PRODUCT: SimulateProduct = {
  id: 'prod-stress',
  title:
    'Producto con un nombre extremadamente largo para validar que el layout no empuje acciones ni rompa el ancho del panel',
  variants: [
    {
      id: 'stress-1',
      color: 'Negro mate con detalle azul eléctrico',
      size: 'Extra grande',
      capacity: '256GB edición limitada',
      currentPrice: 999999,
      label:
        'Negro mate con detalle azul eléctrico / Extra grande / 256GB edición limitada',
    },
    {
      id: 'stress-2',
      color: 'Blanco',
      size: null,
      capacity: '128GB',
      currentPrice: 850000,
      label: 'Blanco / 128GB',
    },
    {
      id: 'stress-3',
      color: 'Grafito',
      size: null,
      capacity: '64GB',
      currentPrice: 720000,
      label: 'Grafito / 64GB',
    },
    {
      id: 'stress-4',
      color: 'Azul',
      size: null,
      capacity: '512GB',
      currentPrice: 1200000,
      label: 'Azul / 512GB',
    },
  ],
};

describe('SimulatorComponent', () => {
  let component: SimulatorComponent;
  let fixture: ComponentFixture<SimulatorComponent>;
  let api: jasmine.SpyObj<ApiHttpService>;
  let header: jasmine.SpyObj<HeaderService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<ApiHttpService>('ApiHttpService', [
      'get',
      'post',
    ]);
    header = jasmine.createSpyObj<HeaderService>('HeaderService', ['set']);

    api.get.and.returnValue(of(MOCK_OPTIONS));
    api.post.and.returnValue(of(MOCK_RESULTS));

    await TestBed.configureTestingModule({
      imports: [SimulatorComponent, NoopAnimationsModule],
      providers: [
        { provide: ApiHttpService, useValue: api },
        { provide: HeaderService, useValue: header },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SimulatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga opciones iniciales y configura el header', () => {
    expect(header.set).toHaveBeenCalledWith([{ label: 'Simulador' }]);
    expect(api.get).toHaveBeenCalledWith('credits/simulate/options');
    expect(component.loadingOptions).toBeFalse();
    expect(component.hasOptions).toBeTrue();
  });

  it('renderiza la estructura visual del simulador con el panel dark', () => {
    const shell = fixture.debugElement.query(By.css('.sim-shell'));
    const card = fixture.debugElement.query(
      By.css('.sim-card.sim-card--entry'),
    );
    const toggle = fixture.debugElement.query(By.css('.sim-toggle'));
    const title = fixture.nativeElement.textContent as string;

    expect(shell).toBeTruthy();
    expect(card).toBeTruthy();
    expect(toggle).toBeTruthy();
    expect(title).toContain('Simular financiamiento');
  });

  it('mantiene visible la estructura superior con padding y card de entrada sin clase de resultados', () => {
    const shell = fixture.debugElement.query(By.css('.sim-shell'))
      .nativeElement as HTMLElement;
    const entryCard = fixture.debugElement.query(By.css('.sim-card--entry'));
    const resultsCard = fixture.debugElement.query(
      By.css('.sim-card--results'),
    );

    expect(shell.classList.contains('sim-shell')).toBeTrue();
    expect(entryCard).toBeTruthy();
    expect(resultsCard).toBeNull();
  });

  it('monta el autocomplete en body para que el listado no quede cortado por la card', () => {
    component.setOperationType('SALE');
    fixture.detectChanges();

    const autoComplete = fixture.debugElement.query(By.directive(AutoComplete))
      .componentInstance as AutoComplete;

    expect(autoComplete.appendTo).toBe('body');
  });

  it('no permite continuar un préstamo sin monto válido', () => {
    component.amount = 0;

    expect(component.canContinue).toBeFalse();

    component.continue();

    expect(api.post).not.toHaveBeenCalled();
    expect(component.step).toBe(1);
  });

  it('simula un préstamo y agrupa las opciones por frecuencia', () => {
    component.amount = 100000;

    component.continue();

    fixture.detectChanges();

    expect(api.post).toHaveBeenCalledWith('credits/simulate/all', {
      type: 'LOAN',
      total_amount: 100000,
    });
    expect(component.step).toBe(2);
    expect(component.calculating).toBeFalse();
    expect(component.groups.map((group) => group.frequency)).toEqual([
      'WEEKLY',
      'MONTHLY',
    ]);
  });

  it('auto-selecciona la única variante del producto y simula una venta', () => {
    component.setOperationType('SALE');
    component.selectedProduct = MOCK_PRODUCT;

    component.onProductSelect();
    component.continue();

    expect(component.selectedVariant?.id).toBe('var-1');
    expect(component.simulatedAmount).toBe(250000);
    expect(api.post).toHaveBeenCalledWith('credits/simulate/all', {
      type: 'SALE',
      products: [{ variant_id: 'var-1', quantity: 1 }],
    });
  });

  it('renderiza muchas variantes y marca visualmente la seleccionada', () => {
    component.setOperationType('SALE');
    component.selectedProduct = VISUAL_STRESS_PRODUCT;
    fixture.detectChanges();

    const variants = fixture.debugElement.queryAll(By.css('.sim-variant'));
    expect(variants.length).toBe(4);

    component.selectVariant(VISUAL_STRESS_PRODUCT.variants[0]);
    fixture.detectChanges();

    const activeVariant = fixture.debugElement.query(
      By.css('.sim-variant--active'),
    );
    const text = activeVariant.nativeElement.textContent as string;

    expect(activeVariant).toBeTruthy();
    expect(text).toContain('Negro mate con detalle azul eléctrico');
  });

  it('debouncea la búsqueda de productos antes de consultar la API', fakeAsync(() => {
    api.get.calls.reset();
    api.get.and.returnValue(of([]));

    component.searchProducts({ query: 'sam' });
    tick(299);

    expect(api.get).not.toHaveBeenCalled();

    tick(1);

    expect(api.get).toHaveBeenCalledWith(
      'credits/simulate/products?search=sam&limit=10',
    );
  }));

  it('pasa al resumen al seleccionar una opción y puede volver', () => {
    component.amount = 100000;
    component.continue();

    const option = component.groups[0].options[0];
    component.select(option);

    expect(component.step).toBe(3);
    expect(component.selected).toBe(option);

    component.back();

    expect(component.step).toBe(2);
    expect(component.selected).toBeNull();
  });

  it('muestra solo tres opciones iniciales y expande con ver más', () => {
    api.post.and.returnValue(of(MANY_MONTHLY_RESULTS));
    component.amount = 100000;

    component.continue();
    fixture.detectChanges();

    expect(component.groups[0].options.length).toBe(4);
    expect(component.visibleOptions(component.groups[0]).length).toBe(3);
    expect(fixture.debugElement.query(By.css('.sim-more-button'))).toBeTruthy();

    component.showMore('MONTHLY');
    fixture.detectChanges();

    expect(component.visibleOptions(component.groups[0]).length).toBe(4);
  });

  it('renderiza resumen con cards de detalle y permite finalizar reiniciando el flujo', () => {
    component.amount = 100000;
    component.continue();
    component.select(component.groups[0].options[0]);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.sim-highlight'))).toBeTruthy();
    expect(
      fixture.debugElement.queryAll(By.css('.sim-detail-card')).length,
    ).toBe(4);
    expect(fixture.nativeElement.textContent).toContain('Total a devolver');

    component.restart();
    fixture.detectChanges();

    expect(component.step).toBe(1);
    expect(component.selected).toBeNull();
    expect(fixture.debugElement.query(By.css('.sim-card--entry'))).toBeTruthy();
  });

  it('muestra estado sin resultados si la simulación falla', () => {
    api.post.and.returnValue(throwError(() => new Error('500')));
    component.amount = 100000;

    component.continue();

    fixture.detectChanges();

    expect(component.step).toBe(2);
    expect(component.noResults).toBeTrue();
    expect(component.calculating).toBeFalse();
  });
});
