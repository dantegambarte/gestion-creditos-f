import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { FormatService } from '../../core/services/format.service';
import { provideAuthTesting } from '../../core/auth/testing/auth-testing';
import { ProductUnitsService } from '../../features/seller/products/product-units.service';
import { ProductVariantsService } from '../../features/seller/products/product-variants.service';
import { ProductsService } from '../../features/seller/products/products.service';
import { ProductsComponent } from './products.component';

describe('ProductsComponent', () => {
  let component: ProductsComponent;
  let fixture: ComponentFixture<ProductsComponent>;
  let router: Router;

  const productsServiceMock = {
    list: jasmine.createSpy('list'),
    create: jasmine.createSpy('create'),
  };

  const formatServiceMock = {
    currency: jasmine.createSpy('currency').and.returnValue('$0'),
    percent: jasmine.createSpy('percent').and.returnValue('0%'),
  };

  const productVariantsServiceMock = {
    create: jasmine.createSpy('create'),
  };

  const productUnitsServiceMock = {
    createBulk: jasmine.createSpy('createBulk'),
  };

  const messageServiceMock = {
    add: jasmine.createSpy('add'),
  };

  function buildListItem(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'prod-list-1',
      title: 'Producto listado',
      description: 'Desc',
      model: null,
      status: 'ACTIVE',
      createdAt: '',
      updatedAt: '',
      categoryId: 'cat-1',
      categoryName: 'Electrónica',
      brandId: null,
      brandName: null,
      availableCount: 2,
      reservedCount: 0,
      soldCount: 0,
      variants: [
        {
          id: 'var-list-1',
          color: null,
          size: null,
          capacity: null,
          currentPrice: 2500,
          status: 'ACTIVE',
        },
      ],
      ...overrides,
    };
  }

  beforeEach(async () => {
    productsServiceMock.list.and.returnValue(of([]));
    productsServiceMock.create.and.returnValue(of({
      id: 'prod-1', title: 'Producto', description: 'Desc', model: null,
      status: 'ACTIVE', createdAt: '', updatedAt: '', categoryId: null,
      categoryName: null, brandId: null, brandName: null,
      availableCount: 0, reservedCount: 0, soldCount: 0, variants: [],
    }));
    productVariantsServiceMock.create.and.returnValue(of({
      id: 'var-1', color: null, size: null, capacity: null,
      currentPrice: 1500, status: 'ACTIVE', createdAt: '', updatedAt: '',
      productId: 'prod-1', productName: 'Producto', title: 'Producto',
      model: null, productStatus: 'ACTIVE', brandId: null, brandName: null,
    }));
    productUnitsServiceMock.createBulk.and.returnValue(of({ created: 3, units: [] }));
    messageServiceMock.add.calls.reset();

    await TestBed.configureTestingModule({
      imports: [ProductsComponent],
      providers: [
        provideRouter([]),
        { provide: ProductsService, useValue: productsServiceMock },
        {
          provide: ProductVariantsService,
          useValue: productVariantsServiceMock,
        },
        { provide: ProductUnitsService, useValue: productUnitsServiceMock },
        { provide: FormatService, useValue: formatServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        ...provideAuthTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(ProductsComponent);
    component = fixture.componentInstance;
    component.showCreateModal = true;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('deshabilita Guardar Producto mientras el formulario es inválido', () => {
    const buttons = fixture.debugElement.queryAll(By.css('p-button'));
    const saveButton = buttons[buttons.length - 1].componentInstance;

    expect(component.form.invalid).toBeTrue();
    expect(component.isCreateDisabled).toBeTrue();
    expect(saveButton.disabled).toBeTrue();
  });

  it('habilita Guardar Producto cuando se completan los campos requeridos', () => {
    component.form.patchValue({
      codigo: 'PRD-001',
      categoria: 'Electrónica',
      precioCompra: 1000,
      precioVenta: 1500,
      stockInicial: 3,
      estado: 'activo',
    });
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('p-button'));
    const saveButton = buttons[buttons.length - 1].componentInstance;

    expect(component.form.valid).toBeTrue();
    expect(component.isCreateDisabled).toBeFalse();
    expect(saveButton.disabled).toBeFalse();
  });

  it('crea variante y unidades iniciales para reflejar precio y stock en el listado', () => {
    component.form.patchValue({
      codigo: 'PRD 001',
      categoria: 'Electrónica',
      descripcion: 'Producto demo',
      marca: 'MarcaX',
      modelo: 'ModeloY',
      precioCompra: 1000,
      precioVenta: 1500,
      stockInicial: 3,
      estado: 'activo',
    });
    fixture.detectChanges();

    component.saveProduct();

    // Verifica que el chain rxjs completo corrió
    expect(productsServiceMock.create).toHaveBeenCalled();
    expect(productVariantsServiceMock.create).toHaveBeenCalledWith({
      productId: 'prod-1',
      currentPrice: 1500,
    });
    expect(productUnitsServiceMock.createBulk).toHaveBeenCalledWith({
      variantId: 'var-1',
      units: [
        { unitCode: 'PRD-001-001' },
        { unitCode: 'PRD-001-002' },
        { unitCode: 'PRD-001-003' },
      ],
    });
    // Verifica estado del componente tras éxito (next callback corrió)
    expect(component.showCreateModal).toBeFalse();
    expect(component.submitted).toBeFalse();
  });

  it('mapea la categoría real del producto en el listado compartido', () => {
    productsServiceMock.list.and.returnValue(of([buildListItem()]));

    const freshFixture = TestBed.createComponent(ProductsComponent);
    const freshComponent = freshFixture.componentInstance;
    freshFixture.detectChanges();

    expect(freshComponent.products[0].category).toBe('Electrónica');
  });

  it('navega a edición cuando se usa la acción Editar del listado', () => {
    const navigateSpy = spyOn(router, 'navigate');

    component.navigateToEdit('prod-123');

    expect(navigateSpy).toHaveBeenCalledWith(['seller/products/prod-123/edit']);
  });
});
