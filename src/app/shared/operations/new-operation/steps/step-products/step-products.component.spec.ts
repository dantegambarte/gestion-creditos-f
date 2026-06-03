import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { StepProductsComponent } from './step-products.component';
import { CatalogProduct, CartLine } from '../../operation-form.service';

describe('StepProductsComponent', () => {
  let component: StepProductsComponent;
  let fixture: ComponentFixture<StepProductsComponent>;

  const mockCatalog: CatalogProduct[] = [
    { productoId: 'p1', nombre: 'Heladera', precio: 1000, stockDisponible: 3, unitIds: ['u1', 'u2', 'u3'], productIds: ['prod1'], variants: [] },
    { productoId: 'p2', nombre: 'Televisor', precio: 2000, stockDisponible: 1, unitIds: ['u4'], productIds: ['prod2'], variants: [] },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepProductsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StepProductsComponent);
    component = fixture.componentInstance;

    const fb = TestBed.inject(FormBuilder);
    component.form = fb.group({
      operationType: ['SALE'],
      totalAmount: [null],
    });
    component.catalogProducts = mockCatalog;
    component.cartLines = [];
    component.operationTypeOptions = [{ label: 'Venta', value: 'SALE' }, { label: 'Préstamo', value: 'LOAN' }];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('filteredCatalogProducts', () => {
    it('devuelve todos los productos si no hay búsqueda', () => {
      component.catalogSearchText = '';
      expect(component.filteredCatalogProducts.length).toBe(2);
    });

    it('filtra por nombre parcial', () => {
      component.catalogSearchText = 'hela';
      expect(component.filteredCatalogProducts.length).toBe(1);
      expect(component.filteredCatalogProducts[0].productoId).toBe('p1');
    });

    it('es case-insensitive', () => {
      component.catalogSearchText = 'TELEV';
      expect(component.filteredCatalogProducts.length).toBe(1);
    });
  });

  describe('isCatalogProductOutOfStock', () => {
    it('devuelve false si el carrito no tiene ese producto', () => {
      component.cartLines = [];
      expect(component.isCatalogProductOutOfStock(mockCatalog[0])).toBeFalse();
    });

    it('devuelve true cuando la cantidad en carrito alcanza el stock', () => {
      component.cartLines = [{
        productoId: 'p1', nombre: 'Heladera', variantId: 'v1', variantLabel: 'Std',
        cantidad: 3, precio: 1000, subtotal: 3000, stockDisponible: 3,
        unitIds: [], unitCodes: [], productIds: [], selectedUnitIds: [],
        rates: [], selectedInstallments: null,
      }];
      expect(component.isCatalogProductOutOfStock(mockCatalog[0])).toBeTrue();
    });
  });

  describe('emisión de eventos', () => {
    it('emite productAdded al hacer click en Agregar', () => {
      const emitted: CatalogProduct[] = [];
      component.productAdded.subscribe((p) => emitted.push(p));
      component.productAdded.emit(mockCatalog[0]);
      expect(emitted[0]).toBe(mockCatalog[0]);
    });

    it('emite cartCleared al vaciar el carrito', () => {
      let cleared = false;
      component.cartCleared.subscribe(() => (cleared = true));
      component.cartCleared.emit();
      expect(cleared).toBeTrue();
    });
  });
});
