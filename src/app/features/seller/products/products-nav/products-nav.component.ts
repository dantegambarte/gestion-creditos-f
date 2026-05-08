import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import { MockAuthService } from '../../../../core/auth/mock-auth.service';
import { ProductVariantsService } from '../product-variants.service';

type ProductTab =
  | 'list'
  | 'new'
  | 'detail'
  | 'variants'
  | 'units'
  | 'categories'
  | 'brands'
  | null;

@Component({
  selector: 'app-products-nav',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './products-nav.component.html',
  styleUrl: './products-nav.component.scss',
})
export class ProductsNavComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly authService = inject(MockAuthService);
  private readonly variantsService = inject(ProductVariantsService);
  private readonly destroy$ = new Subject<void>();
  private readonly productId$ = new Subject<string>();

  productId: string | null = null;
  variantId: string | null = null;
  /** Primer variantId disponible para el producto actual (cargado via API). */
  firstVariantId: string | null = null;
  basePath = '';
  isAdmin = false;
  currentUrl = '';

  private static readonly BASE_RE = /^\/(seller|admin)/;
  private static readonly PRODUCT_ID_RE = /\/products\/([^/]+)/;
  private static readonly VARIANT_ID_RE = /\/variants\/([^/]+)/;
  private static readonly CONFIG_RE = /\/products\/config\//;

  ngOnInit(): void {
    this.isAdmin = this.authService.hasRole('ADMIN');
    this.parseUrl(this.router.url);

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe((e) => this.parseUrl(e.urlAfterRedirects));

    this.productId$
      .pipe(
        distinctUntilChanged(),
        switchMap((pid) => this.variantsService.getAll({ productId: pid })),
        takeUntil(this.destroy$),
      )
      .subscribe((variants) => {
        this.firstVariantId = variants[0]?.id ?? null;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Extrae base, productId y variantId de la URL activa para construir los links contextuales.
   * @param {string} url - URL actual del router.
   */
  private parseUrl(url: string): void {
    this.currentUrl = url.split('?')[0];

    const baseMatch = ProductsNavComponent.BASE_RE.exec(url);
    this.basePath = baseMatch ? `/${baseMatch[1]}` : '/seller';

    if (ProductsNavComponent.CONFIG_RE.test(url)) {
      this.productId = null;
      this.variantId = null;
      return;
    }

    const idMatch = ProductsNavComponent.PRODUCT_ID_RE.exec(url);
    const rawId = idMatch?.[1];
    const newProductId = rawId && rawId !== 'new' ? rawId : null;

    if (newProductId !== this.productId) {
      this.productId = newProductId;
      this.firstVariantId = null;
      if (newProductId) this.productId$.next(newProductId);
    }

    const variantMatch = ProductsNavComponent.VARIANT_ID_RE.exec(url);
    this.variantId = variantMatch?.[1] ?? null;
  }

  /** Tab activa según la URL actual. */
  get activeTab(): ProductTab {
    const url = this.currentUrl;
    if (/\/products\/config\/categories/.test(url)) return 'categories';
    if (/\/products\/config\/brands/.test(url)) return 'brands';
    if (/\/products\/[^/]+\/variants\/[^/]+\/units/.test(url)) return 'units';
    if (/\/products\/[^/]+\/variants/.test(url)) return 'variants';
    if (/\/products\/[^/]+\/edit/.test(url)) return null;
    if (/\/products\/[^/]+$/.test(url)) return 'detail';
    if (/\/products\/new$/.test(url)) return 'new';
    if (/\/products$/.test(url)) return 'list';
    return null;
  }

  /** Link al listado de productos. */
  get listLink(): string {
    return `${this.basePath}/products`;
  }

  /** Link al formulario de creación (solo para admin). */
  get newLink(): string {
    return `${this.basePath}/products/new`;
  }

  /** Link al detalle del producto activo, o null si no hay producto en la URL. */
  get detailLink(): string | null {
    return this.productId
      ? `${this.basePath}/products/${this.productId}`
      : null;
  }

  /** Link a la pantalla de variantes del producto activo, o null si no hay producto. */
  get variantsLink(): string | null {
    return this.productId
      ? `${this.basePath}/products/${this.productId}/variants`
      : null;
  }

  /** Variantid efectivo: el de la URL (si estamos en units) o el primero del producto. */
  get effectiveVariantId(): string | null {
    return this.variantId ?? this.firstVariantId;
  }

  /** Link a la pantalla de unidades. Usa el variantId de la URL o el primer variantId del producto. */
  get unitsLink(): string | null {
    const vid = this.effectiveVariantId;
    return this.productId && vid
      ? `${this.basePath}/products/${this.productId}/variants/${vid}/units`
      : null;
  }

  /** Link a la pantalla de categorías de productos. */
  get categoriesLink(): string {
    return `${this.basePath}/products/config/categories`;
  }

  /** Link a la pantalla de marcas de productos. */
  get brandsLink(): string {
    return `${this.basePath}/products/config/brands`;
  }
}
