import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ProductRatesService } from '../../../features/admin/config/services/product-rates.service';
import { ProductRate } from '../../../features/admin/config/models/interfaces/product';
import { ProductUnitsService } from '../../../features/seller/products/product-units.service';
import { ProductOperation } from '../../models/interface/product';
import { PaymentFrequency } from '../../models/payment-frequency';

export type CatalogProduct = {
  productoId: string;
  nombre: string;
  precio: number;
  stockDisponible: number;
  unitIds: string[];
  productIds: string[];
  variants: CatalogVariant[];
};

export type CatalogVariant = {
  variantId: string;
  label: string;
  precio: number;
  stockDisponible: number;
  unitIds: string[];
  productIds: string[];
  unitCodes: string[];
  color?: string | null;
  size?: string | null;
  capacity?: string | null;
};

export type SaleInstallmentOption = {
  label: string;
  value: number;
  frequency: PaymentFrequency;
};

@Injectable()
export class OperationCatalogService {
  private readonly productUnitsService = inject(ProductUnitsService);
  private readonly productRatesService = inject(ProductRatesService);

  availableProducts: ProductOperation[] = [];
  catalogProducts: CatalogProduct[] = [];
  productRates: ProductRate[] = [];
  loadingProductRatesByCatalogId: Record<string, boolean> = {};
  loadingSaleData = false;

  private loaded = false;

  /** Indica si el catálogo de venta ya fue cargado en esta sesión del wizard. */
  get isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Carga unidades disponibles del backend y reconstruye el catálogo agrupado.
   */
  loadSaleData(): Observable<void> {
    this.loadingSaleData = true;
    return this.productUnitsService.getAll({ status: 'AVAILABLE' }).pipe(
      map((units) => {
        this.availableProducts = units.map((u) => ({
          id: u.id,
          productId: u.productId,
          variantId: u.variantId,
          name: u.productName,
          price: u.currentPrice,
          stock: 1,
          unitCode: u.unitCode,
          historicalPrice: u.currentPrice,
          color: u.color,
          size: u.size,
          capacity: u.capacity,
        }));
        this.loaded = true;
        this.loadingSaleData = false;
        this.catalogProducts = this.buildCatalogProducts();
      }),
    );
  }

  /**
   * Carga y cachea las tasas activas de un producto específico.
   * @param productId - Identificador del producto.
   */
  loadProductRatesByProductId(productId: string): Observable<ProductRate[]> {
    return this.productRatesService.getAll({ productId }).pipe(
      map((rates) => {
        const activeRates = rates.filter((r) => r.active);
        const kept = this.productRates.filter((r) => r.productId !== productId);
        this.productRates = [...kept, ...activeRates];
        return activeRates;
      }),
    );
  }

  /**
   * Reconstruye el catálogo desde las unidades disponibles actualmente cargadas.
   */
  rebuildCatalog(): void {
    this.catalogProducts = this.buildCatalogProducts();
  }

  /**
   * Resetea los flags de carga por producto (se llama al vaciar el carrito).
   */
  resetLoadingStates(): void {
    this.loadingProductRatesByCatalogId = {};
  }

  /**
   * Resetea todo el estado del catálogo (se llama al recargar tras error de unidad stale).
   */
  reset(): void {
    this.loaded = false;
    this.availableProducts = [];
    this.catalogProducts = [];
    this.productRates = [];
    this.loadingProductRatesByCatalogId = {};
    this.loadingSaleData = false;
  }

  /**
   * Agrupa unidades disponibles por producto para construir el catálogo del paso 2.
   */
  buildCatalogProducts(): CatalogProduct[] {
    const groups = new Map<string, CatalogProduct>();
    for (const unit of this.availableProducts) {
      const price = unit.historicalPrice ?? unit.price ?? 0;
      const key = this.getCatalogGroupKey(unit, price);
      const existing = groups.get(key);
      if (existing) {
        existing.stockDisponible += 1;
        existing.unitIds.push(unit.id);
        if (unit.productId && !existing.productIds.includes(unit.productId)) {
          existing.productIds.push(unit.productId);
        }
        this.upsertCatalogVariant(existing, unit, price);
      } else {
        const nextProduct: CatalogProduct = {
          productoId: unit.productId || key,
          nombre: unit.name,
          precio: price,
          stockDisponible: 1,
          unitIds: [unit.id],
          productIds: unit.productId ? [unit.productId] : [],
          variants: [],
        };
        this.upsertCatalogVariant(nextProduct, unit, price);
        groups.set(key, nextProduct);
      }
    }
    return Array.from(groups.values());
  }

  /**
   * Define la clave de agrupación del catálogo priorizando el `productId` real.
   * Evita mezclar stock de productos distintos que comparten nombre y precio visible.
   * @param unit - Unidad disponible devuelta por backend.
   * @param price - Precio histórico/actual usado en el catálogo.
   */
  private getCatalogGroupKey(unit: ProductOperation, price: number): string {
    return unit.productId || `${unit.name}__${price}`;
  }

  /**
   * Inserta o actualiza una variante dentro del producto agrupado del catálogo.
   * @param product - Grupo principal del catálogo.
   * @param unit - Unidad concreta recibida del backend.
   * @param price - Precio visible asociado a la unidad.
   */
  private upsertCatalogVariant(
    product: CatalogProduct,
    unit: ProductOperation,
    price: number,
  ): void {
    const variantId = unit.variantId || `${product.productoId}__default`;
    const existing = product.variants.find((item) => item.variantId === variantId);
    if (existing) {
      existing.stockDisponible += 1;
      existing.unitIds.push(unit.id);
      existing.unitCodes.push(unit.unitCode ?? unit.id);
      if (unit.productId && !existing.productIds.includes(unit.productId)) {
        existing.productIds.push(unit.productId);
      }
      return;
    }

    product.variants.push({
      variantId,
      label: this.buildVariantLabel(unit),
      precio: price,
      stockDisponible: 1,
      unitIds: [unit.id],
      unitCodes: [unit.unitCode ?? unit.id],
      productIds: unit.productId ? [unit.productId] : [],
      color: unit.color,
      size: unit.size,
      capacity: unit.capacity,
    });
  }

  /**
   * Arma una etiqueta humana para una variante a partir de color, tamaño o capacidad.
   * @param unit - Unidad concreta con sus atributos de variante.
   */
  private buildVariantLabel(unit: ProductOperation): string {
    const parts = [unit.color, unit.size, unit.capacity]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));
    return parts.length > 0 ? parts.join(' · ') : 'Variante estándar';
  }
}
