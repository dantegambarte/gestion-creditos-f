import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { StepProductsComponent } from './step-products.component';
import { CatalogProduct, CatalogVariant, CartLine } from '../../operation-form.service';

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

  describe('acciones sobre la selección activa', () => {
    const variant = (variantId: string, stock: number, unitIds: string[], unitCodes: string[]): CatalogVariant => ({
      variantId, label: variantId, precio: 1000, stockDisponible: stock, unitIds, productIds: ['prod1'], unitCodes,
    });
    const phone: CatalogProduct = {
      productoId: 'p3', nombre: 'Celular', precio: 1000, stockDisponible: 3,
      unitIds: ['u5', 'u6', 'u7'], productIds: ['prod3'],
      variants: [variant('negro', 2, ['u5', 'u6'], ['IMEI-5', 'IMEI-6']), variant('rojo', 1, ['u7'], ['IMEI-7'])],
    };
    const line = (variantId: string, selectedUnitIds: string[]): CartLine => ({
      productoId: 'p3', nombre: 'Celular', variantId, variantLabel: variantId,
      cantidad: selectedUnitIds.length, precio: 1000, subtotal: 1000 * selectedUnitIds.length, stockDisponible: 2,
      unitIds: ['u5', 'u6'], unitCodes: ['IMEI-5', 'IMEI-6'], productIds: [], selectedUnitIds,
      rates: [], selectedInstallments: null,
    });

    beforeEach(() => {
      component.catalogProducts = [phone];
      component.selectProduct(phone);
    });

    it('al elegir un producto selecciona su primera variante', () => {
      expect(component.selectedProduct).toBe(phone);
      expect(component.selectedVariantId).toBe('negro');
    });

    it('addUnit emite exactamente la unidad clickeada con producto y variante activos', () => {
      const emitted: unknown[] = [];
      component.unitAdded.subscribe((e) => emitted.push(e));
      component.selectVariant('negro');

      component.addUnit('u6');

      expect(emitted).toEqual([{ product: phone, variantId: 'negro', unitId: 'u6' }]);
    });

    it('addUnit no emite si no hay producto seleccionado', () => {
      const spy = spyOn(component.unitAdded, 'emit');
      component.resetSelection();

      component.addUnit('u6');

      expect(spy).not.toHaveBeenCalled();
    });

    it('removeUnit emite la referencia de la unidad a quitar', () => {
      const emitted: unknown[] = [];
      component.unitRemoved.subscribe((e) => emitted.push(e));

      component.removeUnit('u5');

      expect(emitted).toEqual([{ productoId: 'p3', variantId: 'negro', unitId: 'u5' }]);
    });

    it('addSelectedVariant emite la variante activa', () => {
      const emitted: unknown[] = [];
      component.productVariantAdded.subscribe((e) => emitted.push(e));
      component.selectVariant('rojo');

      component.addSelectedVariant();

      expect(emitted).toEqual([{ product: phone, variantId: 'rojo' }]);
    });

    it('calcula el stock restante y el agotamiento por variante según el carrito', () => {
      component.cartLines = [line('negro', ['u5'])];
      const [negro, rojo] = phone.variants;

      expect(component.getVariantRemainingStock(negro)).toBe(1);
      expect(component.isVariantOutOfStock(negro)).toBeFalse();
      expect(component.getVariantRemainingStock(rojo)).toBe(1);

      component.cartLines = [line('negro', ['u5', 'u6'])];
      expect(component.isVariantOutOfStock(negro)).toBeTrue();
      expect(component.isVariantFullyReserved(negro)).toBeTrue();
    });

    it('marca como seleccionadas solo las unidades de la línea activa y muestra sus IMEI en orden de carga', () => {
      const cart = line('negro', ['u6', 'u5']);
      component.cartLines = [cart];

      expect(component.isUnitSelected('u6')).toBeTrue();
      expect(component.isUnitSelected('u7')).toBeFalse();
      expect(component.selectedUnitCodes(cart)).toEqual(['IMEI-6', 'IMEI-5']);
    });

    it('al quitar una línea desde el carrito emite su referencia producto/variante', () => {
      const emitted: unknown[] = [];
      component.productRemoved.subscribe((e) => emitted.push(e));
      component.cartLines = [line('rojo', ['u7'])];
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[title="Quitar todas las unidades de esta línea"]') as HTMLButtonElement;
      button.click();

      expect(emitted).toEqual([{ productoId: 'p3', variantId: 'rojo' }]);
    });

    it('al cambiar el catálogo y desaparecer el producto activo, selecciona el primero disponible', () => {
      component.catalogProducts = mockCatalog;
      component.ngOnChanges({ catalogProducts: {} as never });

      expect(component.selectedProductId).toBe('p1');
      expect(component.selectedVariantId).toBeNull();
    });
  });

  it('resume subtotal, unidades y líneas del carrito', () => {
    component.cartLines = [
      { productoId: 'p1', subtotal: 2000, cantidad: 2 } as CartLine,
      { productoId: 'p2', subtotal: 1500, cantidad: 1 } as CartLine,
    ];

    expect(component.activeOperationSubtotal).toBe(3500);
    expect(component.cartItemsCount).toBe(3);
    expect(component.cartLinesCount).toBe(2);
  });
});
