import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { BulkVariantEntryComponent } from './bulk-variant-entry.component';
import { ProductVariantsService } from '../../product-variants.service';
import { ProductVariant } from '../../../models/product-variant.model';

describe('BulkVariantEntryComponent saveBulk', () => {
  let component: BulkVariantEntryComponent;
  let variantsSpy: jasmine.SpyObj<ProductVariantsService>;

  beforeEach(() => {
    variantsSpy = jasmine.createSpyObj<ProductVariantsService>('ProductVariantsService', [
      'create',
    ]);
    TestBed.configureTestingModule({
      providers: [{ provide: ProductVariantsService, useValue: variantsSpy }, MessageService],
    });
    component = TestBed.runInInjectionContext(() => new BulkVariantEntryComponent());
    component.productId = 'p1';
    component.bulkRows = ['Rojo', 'Azul', 'Verde'].map((color) => ({
      color,
      size: '',
      capacity: '',
      currentPrice: 100,
      initialUnits: 1,
    }));
  });

  it('marks the failing row at its new position after removing created rows', async () => {
    variantsSpy.create.and.callFake((payload) =>
      payload.color === 'Verde'
        ? throwError(() => ({ status: 409, message: 'Duplicada' }))
        : of({} as ProductVariant),
    );

    await component.saveBulk();

    expect(component.bulkRows.length).toBe(1);
    expect(component.bulkRows[0].color).toBe('Verde');
    expect(component.bulkRowErrors[0]?.attributes).toBe('Duplicada');
    expect(component.bulkRowErrors[2]).toBeUndefined();
  });

  it('creates every row when none fails', async () => {
    variantsSpy.create.and.returnValue(of({} as ProductVariant));

    await component.saveBulk();

    expect(variantsSpy.create).toHaveBeenCalledTimes(3);
    expect(component.bulkError).toBeNull();
  });
});
