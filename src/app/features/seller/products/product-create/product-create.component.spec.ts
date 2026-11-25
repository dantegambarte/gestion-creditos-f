import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { HeaderService } from '../../../../core/services/header.service';
import { ProductBrandsService } from '../../../admin/config/services/product-brands.service';
import { ProductCategoriesService } from '../../../admin/config/services/product-categories.service';
import { ProductsService } from '../products.service';
import { ProductCreateComponent } from './product-create.component';

describe('ProductCreateComponent — validadores de formulario', () => {
  let component: ProductCreateComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCreateComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        MessageService,
        {
          provide: ProductsService,
          useValue: { create: jasmine.createSpy() },
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

    const fixture = TestBed.createComponent(ProductCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('descripción con 501 caracteres → formulario inválido con error maxlength', () => {
    // El campo title es requerido — se lo completamos para aislar la validación de description
    component.form.get('title')!.setValue('Producto de prueba');
    component.form.get('description')!.setValue('a'.repeat(501));

    expect(component.form.invalid).toBeTrue();
    expect(component.form.get('description')!.hasError('maxlength')).toBeTrue();
  });

  it('modelo con 101 caracteres → formulario inválido con error maxlength', () => {
    component.form.get('title')!.setValue('Producto de prueba');
    component.form.get('model')!.setValue('m'.repeat(101));

    expect(component.form.invalid).toBeTrue();
    expect(component.form.get('model')!.hasError('maxlength')).toBeTrue();
  });

  it('datos válidos (title + description=500 + model=100) → formulario válido', () => {
    component.form.get('title')!.setValue('Producto de prueba');
    component.form.get('description')!.setValue('a'.repeat(500));
    component.form.get('model')!.setValue('m'.repeat(100));

    expect(component.form.valid).toBeTrue();
  });
});

describe('ProductCreateComponent — envío (P16)', () => {
  let component: ProductCreateComponent;
  let create: jasmine.Spy;
  let navigate: jasmine.Spy;

  beforeEach(async () => {
    create = jasmine.createSpy('create');
    await TestBed.configureTestingModule({
      imports: [ProductCreateComponent],
      providers: [
        provideRouter([]),
        { provide: ProductsService, useValue: { create } },
        { provide: ProductCategoriesService, useValue: { getAll: () => of([]) } },
        { provide: ProductBrandsService, useValue: { getAll: () => of([]) } },
        { provide: HeaderService, useValue: { set: jasmine.createSpy() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProductCreateComponent);
    component = fixture.componentInstance;
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    component.form.patchValue({ title: 'Producto nuevo' });
  });

  it('mantiene submitting hasta navegar y no permite un segundo alta', fakeAsync(() => {
    create.and.returnValue(of({ id: 'p-1' }));

    component.onSubmit();
    expect(component.submitting).toBeTrue();

    component.onSubmit();
    expect(create).toHaveBeenCalledTimes(1);

    tick(1500);
    expect(navigate).toHaveBeenCalledWith(['/seller/products', 'p-1']);
  }));

  it('libera submitting si el alta falla', () => {
    create.and.returnValue(throwError(() => ({ status: 500, message: 'x' })));

    component.onSubmit();

    expect(component.submitting).toBeFalse();
  });
});
