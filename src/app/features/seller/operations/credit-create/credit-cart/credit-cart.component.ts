import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { CartUnit } from '../../../models/credit.model';
import { ProductUnit } from '../../../models/product-unit.model';
import { ProductVariant } from '../../../models/product-variant.model';
import { Product } from '../../../models/product.model';
import { ProductUnitsService } from '../../../products/product-units.service';
import { ProductVariantsService } from '../../../products/product-variants.service';
import { ProductsService } from '../../../products/products.service';

@Component({
  selector: 'app-credit-cart',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DropdownModule,
    CurrencyArsPipe,
  ],
  templateUrl: './credit-cart.component.html',
})
export class CreditCartComponent implements OnInit {
  /** Monto del enganche para calcular y mostrar el financiado en la tabla. */
  @Input() downPayment = 0;
  /** Error de validación a mostrar debajo del carrito (manejado por el padre). */
  @Input() error: string | null = null;
  /** Emite el carrito actualizado al agregar o eliminar una unidad. */
  @Output() cartChange = new EventEmitter<CartUnit[]>();

  private readonly productsService = inject(ProductsService);
  private readonly variantsService = inject(ProductVariantsService);
  private readonly unitsService = inject(ProductUnitsService);

  selectorProducts: Product[] = [];
  selectorVariants: ProductVariant[] = [];
  selectorUnits: ProductUnit[] = [];
  selectedProductId = '';
  selectedVariantId = '';
  selectedUnitId = '';
  loadingVariants = false;
  loadingUnits = false;
  cart: CartUnit[] = [];

  get productSelectorOptions(): { label: string; value: string }[] {
    return this.selectorProducts.map((p) => ({
      label: `${p.title} — Disponibles: ${p.availableCount}`,
      value: p.id,
    }));
  }

  get variantSelectorOptions(): { label: string; value: string }[] {
    return this.selectorVariants.map((v) => {
      const parts = [v.color, v.size, v.capacity].filter(Boolean);
      const label = parts.length > 0 ? parts.join(' / ') : 'Sin variante';
      return { label: `${label} — $${v.currentPrice}`, value: v.id };
    });
  }

  get unitSelectorOptions(): { label: string; value: string }[] {
    const cartIds = new Set(this.cart.map((c) => c.unitId));
    return this.selectorUnits
      .filter((u) => !cartIds.has(u.id))
      .map((u) => ({ label: u.unitCode, value: u.id }));
  }

  get cartTotal(): number {
    return this.cart.reduce((sum, u) => sum + u.price, 0);
  }

  get financedAmountPreview(): number {
    return Math.max(this.cartTotal - this.downPayment, 0);
  }

  /**
   * Carga los productos activos disponibles para el selector.
   */
  ngOnInit(): void {
    this.productsService.list({ status: 'ACTIVE' }).subscribe({
      next: (data) => (this.selectorProducts = data),
      error: () => {},
    });
  }

  /**
   * Carga las variantes activas del producto seleccionado.
   */
  onProductSelected(): void {
    this.selectedVariantId = '';
    this.selectedUnitId = '';
    this.selectorVariants = [];
    this.selectorUnits = [];
    if (!this.selectedProductId) return;
    this.loadingVariants = true;
    this.variantsService
      .getAll({ productId: this.selectedProductId, status: 'ACTIVE' })
      .subscribe({
        next: (data) => {
          this.selectorVariants = data;
          this.loadingVariants = false;
        },
        error: () => {
          this.loadingVariants = false;
        },
      });
  }

  /**
   * Carga las unidades disponibles de la variante seleccionada.
   */
  onVariantSelected(): void {
    this.selectedUnitId = '';
    this.selectorUnits = [];
    if (!this.selectedVariantId) return;
    this.loadingUnits = true;
    this.unitsService
      .getAll({ variantId: this.selectedVariantId, status: 'AVAILABLE' })
      .subscribe({
        next: (data) => {
          this.selectorUnits = data;
          this.loadingUnits = false;
        },
        error: () => {
          this.loadingUnits = false;
        },
      });
  }

  /**
   * Agrega la unidad seleccionada al carrito y notifica al padre.
   */
  addToCart(): void {
    if (!this.selectedUnitId) return;
    const unit = this.selectorUnits.find((u) => u.id === this.selectedUnitId);
    if (!unit) return;
    const variant = this.selectorVariants.find(
      (v) => v.id === this.selectedVariantId,
    );
    const product = this.selectorProducts.find(
      (p) => p.id === this.selectedProductId,
    );
    const parts = [variant?.color, variant?.size, variant?.capacity].filter(
      Boolean,
    );
    const variantLabel = parts.length > 0 ? parts.join(' / ') : '';
    this.cart.push({
      unitId: unit.id,
      unitCode: unit.unitCode,
      productName: product?.title ?? unit.productName,
      variantLabel,
      price: unit.currentPrice,
      variantId: this.selectedVariantId,
    });
    this.selectedUnitId = '';
    this.cartChange.emit([...this.cart]);
  }

  /**
   * Elimina una unidad del carrito por índice y notifica al padre.
   * @param index posición en el carrito
   */
  removeFromCart(index: number): void {
    this.cart.splice(index, 1);
    this.cartChange.emit([...this.cart]);
  }
}
