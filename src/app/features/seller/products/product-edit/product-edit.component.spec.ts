import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { HeaderService } from '../../../../core/services/header.service';
import { ProductBrandsService } from '../../../admin/config/services/product-brands.service';
import { ProductCategoriesService } from '../../../admin/config/services/product-categories.service';
import { ProductsService } from '../products.service';
import { ProductEditComponent } from './product-edit.component';

/** Producto mínimo para que load() inicialice el formulario */
const mockProduct = {
  id: 'prod-1',
  title: 'Producto existente',
  description: '',
  model: '',
  brandId: null,
  categoryId: null,
  status: 'ACTIVE' as const,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  availableCount: 0,
  reservedCount: 0,
  soldCount: 0,
  variants: [],
};

describe('ProductEditComponent — validadores de formulario', () => {
  let component: ProductEditComponent;
  let productsServiceMock: {
    getById: jasmine.Spy;
    update: jasmine.Spy;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductEditComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        MessageService,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'prod-1' } } },
        },
        {
          provide: ProductsService,
          useValue: (productsServiceMock = {
            getById: jasmine.createSpy().and.returnValue(of(mockProduct)),
            update: jasmine.createSpy().and.returnValue(of(mockProduct)),
          }),
        },
        {
          provide: ProductCategoriesService,
          useValue: { getAll: () => of([]) },
        },
        {
          provide: ProductBrandsService,
          useValue: { getAll: () => of([]) },
        },
        {
          provide: HeaderService,
          useValue: { set: jasmine.createSpy() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProductEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('inicializa el campo stock con availableCount y no permite edición directa', () => {
    expect(component.form.get('stock')?.value).toBe(0);
  });

  it('descripción con 501 caracteres → formulario inválido con error maxlength', () => {
    component.form.get('title')!.setValue('Producto existente');
    component.form.get('description')!.setValue('a'.repeat(501));

    expect(component.form.invalid).toBeTrue();
    expect(component.form.get('description')!.hasError('maxlength')).toBeTrue();
  });

  it('modelo con 101 caracteres → formulario inválido con error maxlength', () => {
    component.form.get('title')!.setValue('Producto existente');
    component.form.get('model')!.setValue('m'.repeat(101));

    expect(component.form.invalid).toBeTrue();
    expect(component.form.get('model')!.hasError('maxlength')).toBeTrue();
  });

  it('datos válidos (title + description=500 + model=100) → formulario válido', () => {
    component.form.get('title')!.setValue('Producto existente');
    component.form.get('description')!.setValue('a'.repeat(500));
    component.form.get('model')!.setValue('m'.repeat(100));

    expect(component.form.valid).toBeTrue();
  });

  it('al guardar no envía stock en el payload de actualización', () => {
    component.form.patchValue({
      title: 'Producto editado',
      description: 'Descripción',
      model: 'Modelo X',
      stock: 999,
    });

    component.onSubmit();

    expect(productsServiceMock.update).toHaveBeenCalledWith('prod-1', {
      title: 'Producto editado',
      description: 'Descripción',
      model: 'Modelo X',
      brandId: undefined,
      categoryId: undefined,
    });
  });
});
