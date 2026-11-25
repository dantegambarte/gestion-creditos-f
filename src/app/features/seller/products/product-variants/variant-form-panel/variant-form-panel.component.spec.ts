import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';

import { VariantFormPanelComponent } from './variant-form-panel.component';
import { ProductVariantsService } from '../../product-variants.service';
import { ProductVariant } from '../../../models/product-variant.model';

const variantA = {
  id: 'a',
  color: 'Rojo',
  size: 'S',
  capacity: null,
  currentPrice: 100,
} as unknown as ProductVariant;
const variantB = {
  id: 'b',
  color: 'Azul',
  size: 'L',
  capacity: null,
  currentPrice: 250,
} as unknown as ProductVariant;

describe('VariantFormPanelComponent ngOnChanges', () => {
  let component: VariantFormPanelComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: ProductVariantsService, useValue: {} }, MessageService],
    });
    component = TestBed.runInInjectionContext(() => new VariantFormPanelComponent());
  });

  it('loads the values of variant A when the panel opens', () => {
    component.visible = true;
    component.variant = variantA;
    component.ngOnChanges({
      visible: new SimpleChange(false, true, false),
      variant: new SimpleChange(null, variantA, false),
    });
    expect(component.form.value.color).toBe('Rojo');
  });

  it('reloads the form when only the variant changes while visible', () => {
    component.visible = true;
    component.variant = variantA;
    component.ngOnChanges({
      visible: new SimpleChange(false, true, false),
      variant: new SimpleChange(null, variantA, false),
    });

    component.variant = variantB;
    component.ngOnChanges({
      variant: new SimpleChange(variantA, variantB, false),
    });

    expect(component.form.value.color).toBe('Azul');
    expect(component.form.value.size).toBe('L');
    expect(component.form.value.currentPrice).toBe(250);
  });
});
