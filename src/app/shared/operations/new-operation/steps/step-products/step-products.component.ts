import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { CurrencyAmountInputDirective } from '../../../../directives/currency-amount-input.directive';
import { CartLine, CartLineRef, CatalogProduct, CatalogVariant } from '../../operation-form.service';

@Component({
  selector: 'app-step-products',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    DropdownModule,
    InputNumberModule,
    CurrencyAmountInputDirective,
    InputTextModule,
    CurrencyArsPipe,
  ],
  templateUrl: './step-products.component.html',
})
export class StepProductsComponent implements OnChanges {
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
  @Output() productVariantAdded = new EventEmitter<{ product: CatalogProduct; variantId: string }>();
  @Output() productRemoved = new EventEmitter<string | CartLineRef>();
  @Output() quantityIncreased = new EventEmitter<string | CartLineRef>();
  @Output() quantityDecreased = new EventEmitter<string | CartLineRef>();
  @Output() cartCleared = new EventEmitter<void>();

  catalogSearchText = '';
  selectedProductId: string | null = null;
  selectedVariantId: string | null = null;
  private lastProductScrollTop = 0;
  @ViewChild('catalogScrollContainer') private catalogScrollContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('productSection') private productSection?: ElementRef<HTMLDivElement>;
  @ViewChild('variantSection') private variantSection?: ElementRef<HTMLDivElement>;
  @ViewChild('unitsSection') private unitsSection?: ElementRef<HTMLDivElement>;

  /**
   * Mantiene una selección válida al cambiar el catálogo filtrado o su contenido.
   * @param {SimpleChanges} changes - Cambios detectados por Angular.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['catalogProducts']) this.ensureValidSelection();
  }

  /**
   * Catálogo filtrado por la búsqueda local del paso 2.
   */
  get filteredCatalogProducts(): CatalogProduct[] {
    const term = this.catalogSearchText.trim().toLowerCase();
    if (!term) return this.catalogProducts;
    return this.catalogProducts.filter((p) => p.nombre.toLowerCase().includes(term));
  }

  /**
   * Devuelve el producto actualmente seleccionado en el catálogo operacional.
   */
  get selectedProduct(): CatalogProduct | null {
    return this.filteredCatalogProducts.find((product) => product.productoId === this.selectedProductId) ?? null;
  }

  /**
   * Devuelve la variante actualmente seleccionada para el producto activo.
   */
  get selectedVariant(): CatalogVariant | null {
    return this.selectedProduct?.variants.find((variant) => variant.variantId === this.selectedVariantId) ?? null;
  }

  /**
   * Devuelve las unidades serializadas visibles para la variante activa.
   */
  get selectedVariantUnitCodes(): string[] {
    return this.selectedVariant?.unitCodes ?? [];
  }

  /**
   * Resume el subtotal actual del carrito para el panel lateral.
   */
  get activeOperationSubtotal(): number {
    return this.cartLines.reduce((acc, line) => acc + line.subtotal, 0);
  }

  /**
   * Devuelve la cantidad total de unidades agregadas al carrito.
   */
  get cartItemsCount(): number {
    return this.cartLines.reduce((acc, line) => acc + line.cantidad, 0);
  }

  /**
   * Devuelve la cantidad total de líneas cargadas en el carrito.
   */
  get cartLinesCount(): number {
    return this.cartLines.length;
  }

  /**
   * Indica si un producto del catálogo ya alcanzó todo su stock en el carrito.
   * @param {CatalogProduct} product - Producto agrupado del catálogo.
   */
  isCatalogProductOutOfStock(product: CatalogProduct): boolean {
    const booked = this.cartLines
      .filter((line) => line.productoId === product.productoId)
      .reduce((acc, line) => acc + line.cantidad, 0);
    return booked >= product.stockDisponible;
  }

  /**
   * Cambia el producto activo del panel operacional y selecciona su primera variante.
   * @param {CatalogProduct} product - Producto elegido en el catálogo.
   */
  selectProduct(product: CatalogProduct): void {
    this.lastProductScrollTop = this.catalogScrollContainer?.nativeElement.scrollTop ?? 0;
    this.selectedProductId = product.productoId;
    this.selectedVariantId = product.variants[0]?.variantId ?? null;
    this.scrollToSection('variant');
  }

  /**
   * Cambia la variante activa dentro del producto seleccionado.
   * @param {string} variantId - Identificador de la variante elegida.
   */
  selectVariant(variantId: string): void {
    this.selectedVariantId = variantId;
    this.scrollToSection('units');
  }

  /**
   * Limpia la selección actual para volver al listado de productos desde cero.
   */
  resetSelection(): void {
    this.selectedProductId = null;
    this.selectedVariantId = null;
    this.restoreProductScroll();
  }

  /**
   * Agrega al carrito la variante actualmente activa usando el nuevo contrato enriquecido.
   */
  addSelectedVariant(): void {
    if (!this.selectedProduct || !this.selectedVariant) return;
    this.productVariantAdded.emit({
      product: this.selectedProduct,
      variantId: this.selectedVariant.variantId,
    });
  }

  /**
   * Informa si una variante puntual ya agotó su stock dentro del carrito.
   * @param {CatalogVariant} variant - Variante concreta a validar.
   */
  isVariantOutOfStock(variant: CatalogVariant): boolean {
    if (!this.selectedProduct) return true;
    const existing = this.findCartLine(this.selectedProduct.productoId, variant.variantId);
    return (existing?.cantidad ?? 0) >= variant.stockDisponible;
  }

  /**
   * Calcula cuántas unidades reales quedan disponibles para seguir agregando.
   * @param {CatalogVariant} variant - Variante concreta dentro del producto activo.
   * @returns {number} Cantidad restante sin reservar en el carrito.
   */
  getVariantRemainingStock(variant: CatalogVariant): number {
    if (!this.selectedProduct) return 0;
    const existing = this.findCartLine(this.selectedProduct.productoId, variant.variantId);
    return Math.max(variant.stockDisponible - (existing?.cantidad ?? 0), 0);
  }

  /**
   * Indica si la variante quedó completamente reservada dentro del carrito actual.
   * @param {CatalogVariant} variant - Variante concreta a evaluar.
   */
  isVariantFullyReserved(variant: CatalogVariant): boolean {
    return this.getVariantRemainingStock(variant) === 0;
  }

  /**
   * Indica si una unidad serializada de la variante activa ya quedó tomada por el carrito.
   * @param {number} index - Posición de la unidad dentro del stock visible.
   */
  isUnitReserved(index: number): boolean {
    return index < (this.selectedCartLine?.cantidad ?? 0);
  }

  /**
   * Devuelve la línea del carrito correspondiente a la selección activa.
   */
  get selectedCartLine(): CartLine | null {
    if (!this.selectedProduct || !this.selectedVariant) return null;
    return this.findCartLine(this.selectedProduct.productoId, this.selectedVariant.variantId) ?? null;
  }

  /**
   * Genera la referencia compuesta para acciones sobre una línea de carrito específica.
   * @param {CartLine} line - Línea del carrito a operar.
   * @returns {CartLineRef} Referencia estable para el padre.
   */
  getCartLineRef(line: CartLine): CartLineRef {
    return { productoId: line.productoId, variantId: line.variantId };
  }

  /**
   * Construye una etiqueta secundaria para cada producto del catálogo.
   * @param {CatalogProduct} product - Producto consultado.
   * @returns {string} Texto resumido con variantes y stock.
   */
  getProductMeta(product: CatalogProduct): string {
    return `${product.variants.length} variante${product.variants.length === 1 ? '' : 's'} · ${product.stockDisponible} disponibles`;
  }

  /**
   * Garantiza que siempre exista una selección válida visible en el catálogo.
   */
  private ensureValidSelection(): void {
    const firstProduct = this.filteredCatalogProducts[0] ?? null;
    if (!firstProduct) {
      this.selectedProductId = null;
      this.selectedVariantId = null;
      return;
    }

    const selectedProductStillExists = this.filteredCatalogProducts.some(
      (product) => product.productoId === this.selectedProductId,
    );
    if (!selectedProductStillExists) this.selectedProductId = firstProduct.productoId;

    const currentProduct = this.filteredCatalogProducts.find(
      (product) => product.productoId === this.selectedProductId,
    );
    const variantExists = currentProduct?.variants.some(
      (variant) => variant.variantId === this.selectedVariantId,
    );
    if (!variantExists) this.selectedVariantId = currentProduct?.variants[0]?.variantId ?? null;
  }

  /**
   * Busca una línea del carrito por producto y variante.
   * @param {string} productoId - Producto base del catálogo.
   * @param {string} variantId - Variante específica.
   * @returns {CartLine | undefined} Línea encontrada si existe.
   */
  private findCartLine(productoId: string, variantId: string): CartLine | undefined {
    return this.cartLines.find(
      (line) => line.productoId === productoId && line.variantId === variantId,
    );
  }

  /**
   * Hace scroll suave hasta la siguiente sección del flujo dentro del panel de catálogo.
   * @param {'product' | 'variant' | 'units'} section - Sección de destino a enfocar.
   */
  private scrollToSection(section: 'product' | 'variant' | 'units'): void {
    setTimeout(() => {
      const target =
        section === 'product'
          ? this.productSection?.nativeElement
          : section === 'variant'
            ? this.variantSection?.nativeElement
            : this.unitsSection?.nativeElement;
      const container = this.catalogScrollContainer?.nativeElement;
      if (!target || !container) return;
      const nextTop = Math.max(0, target.offsetTop - container.offsetTop - 12);
      container.scrollTo({ top: nextTop, behavior: 'smooth' });
    }, 0);
  }

  /**
   * Restaura la posición exacta del catálogo donde el usuario eligió el producto.
   */
  private restoreProductScroll(): void {
    setTimeout(() => {
      const container = this.catalogScrollContainer?.nativeElement;
      if (!container) return;
      container.scrollTo({ top: this.lastProductScrollTop, behavior: 'smooth' });
    }, 0);
  }
}
