import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { CartLine, CatalogProduct } from '../../operation-form.service';

@Component({
  selector: 'app-step-products',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    CurrencyArsPipe,
  ],
  templateUrl: './step-products.component.html',
})
export class StepProductsComponent {
  @Input() form!: FormGroup;
  @Input() operationTypeOptions: { label: string; value: string }[] = [];
  @Input() catalogProducts: CatalogProduct[] = [];
  @Input() cartLines: CartLine[] = [];
  @Input() totalCarrito = 0;
  @Input() prestamoTotal = 0;
  @Input() loadingLoanData = false;
  @Input() loadingSaleData = false;
  @Input() loadingProductRatesByCatalogId: Record<string, boolean> = {};

  @Output() productAdded = new EventEmitter<CatalogProduct>();
  @Output() productRemoved = new EventEmitter<string>();
  @Output() quantityIncreased = new EventEmitter<string>();
  @Output() quantityDecreased = new EventEmitter<string>();
  @Output() cartCleared = new EventEmitter<void>();

  catalogSearchText = '';

  /**
   * Catálogo filtrado por la búsqueda local del paso 2.
   */
  get filteredCatalogProducts(): CatalogProduct[] {
    const term = this.catalogSearchText.trim().toLowerCase();
    if (!term) return this.catalogProducts;
    return this.catalogProducts.filter((p) => p.nombre.toLowerCase().includes(term));
  }

  /**
   * Indica si un producto del catálogo ya alcanzó todo su stock en el carrito.
   * @param {CatalogProduct} product - Producto agrupado del catálogo.
   */
  isCatalogProductOutOfStock(product: CatalogProduct): boolean {
    const existing = this.cartLines.find((line) => line.productoId === product.productoId);
    return (existing?.cantidad ?? 0) >= product.stockDisponible;
  }
}
