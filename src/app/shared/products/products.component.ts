import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';

import { FormatService } from '../../core/services/format.service';
import { Product as ApiProduct } from '../../features/seller/models/product.model';
import { ProductUnitsService } from '../../features/seller/products/product-units.service';
import { ProductVariantsService } from '../../features/seller/products/product-variants.service';
import { ProductsService } from '../../features/seller/products/products.service';
import { AppRoutes } from '../models/enums/routes.enum';
import { Product } from '../models/interface/product';
import { CurrencyAmountInputDirective } from '../directives/currency-amount-input.directive';

function toProduct(p: ApiProduct): Product {
  return {
    id: p.id,
    code: p.id.slice(0, 8).toUpperCase(),
    name: p.title,
    price: p.variants[0]?.currentPrice ?? 0,
    stock: p.availableCount,
    category: p.categoryName ?? '—',
    icon: 'pi-box',
    iconColor: '#6366f1',
  };
}

@Component({
  selector: 'app-products',
  standalone: true,
  providers: [MessageService],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    TagModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    CurrencyAmountInputDirective,
    InputTextareaModule,
    ToastModule,
  ],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss',
})
export class ProductsComponent implements OnInit {
  private readonly productsService = inject(ProductsService);
  private readonly productVariantsService = inject(ProductVariantsService);
  private readonly productUnitsService = inject(ProductUnitsService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  products: Product[] = [];
  loading = false;

  // TODO: reemplazar hardcodeo por categorias propias del backend
  categoryOptions = [
    { label: 'Electrónica', value: 'Electrónica' },
    { label: 'Electrodomésticos', value: 'Electrodomésticos' },
    { label: 'Ropa', value: 'Ropa' },
    { label: 'Hogar', value: 'Hogar' },
    { label: 'Otros', value: 'Otros' },
  ];

  estadoOptions = [
    { label: 'Activo', value: 'activo' },
    { label: 'Inactivo', value: 'inactivo' },
  ];

  searchTerm = '';
  showCreateModal = false;
  submitted = false;
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private fmt: FormatService,
  ) {
    this.form = this.buildForm();
  }

  ngOnInit(): void {
    this.loadProducts();
  }

  // TODO: agregar documentacion de las funciones

  private loadProducts(): void {
    this.loading = true;
    this.productsService.list({ status: 'ACTIVE' }).subscribe({
      next: (items) => {
        this.products = items.map(toProduct);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  get filteredProducts(): Product[] {
    if (!this.searchTerm) return this.products;
    const term = this.searchTerm.toLowerCase();
    return this.products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term),
    );
  }

  get margen(): string {
    const compra = this.form.get('precioCompra')?.value ?? 0;
    const venta = this.form.get('precioVenta')?.value ?? 0;
    if (!compra || compra === 0) return '--%';
    return this.fmt.percent((venta - compra) / compra, 1);
  }

  getStockStatus(stock: number): 'activo' | 'stock-bajo' | 'sin-stock' {
    if (stock === 0) return 'sin-stock';
    if (stock <= 3) return 'stock-bajo';
    return 'activo';
  }

  getRowClass(stock: number): string {
    const status = this.getStockStatus(stock);
    if (status === 'sin-stock') return 'row-sin-stock';
    if (status === 'stock-bajo') return 'row-stock-bajo';
    return '';
  }

  formatPrice(price: number): string {
    return this.fmt.currency(price);
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!ctrl && ctrl.invalid && (ctrl.touched || this.submitted);
  }

  /**
   * Indica si la acción de guardar debe permanecer deshabilitada según el estado actual del formulario.
   * @returns {boolean} `true` cuando faltan campos requeridos o contienen valores inválidos.
   */
  get isCreateDisabled(): boolean {
    return this.form.invalid;
  }

  /**
   * Cancela la creación del producto, cierra el modal y reinicia el formulario a su estado inicial.
   */
  cancelCreate(): void {
    this.showCreateModal = false;
    this.submitted = false;
    this.form = this.buildForm();
  }

  /**
   * Navega a la pantalla de edición del producto seleccionado para completar cambios más avanzados.
   * @param {string} productId - Identificador del producto a editar.
   */
  navigateToEdit(productId: string): void {
    this.router.navigate([
      AppRoutes.SELLER_PRODUCTS_EDIT.replace(':id', productId),
    ]);
  }

  /**
   * Crea un producto nuevo usando los campos válidos del modal y refresca el listado al confirmar.
   */
  saveProduct(): void {
    this.submitted = true;
    if (this.form.invalid) return;

    const { codigo, descripcion, marca, modelo, precioVenta, stockInicial } =
      this.form.value;
    const nameParts = [codigo, marca, modelo].filter(Boolean);
    const name = nameParts.join(' ') || descripcion || codigo;
    const description = descripcion || name;
    const initialUnits = this.buildInitialUnits(codigo, stockInicial);

    this.productsService
      .create({
        title: name,
        description,
      })
      .pipe(
        switchMap((product) =>
          this.productVariantsService
            .create({
              productId: product.id,
              currentPrice: Number(precioVenta),
            })
            .pipe(
              switchMap((variant) =>
                initialUnits.length > 0
                  ? this.productUnitsService.createBulk({
                      variantId: variant.id,
                      units: initialUnits,
                    })
                  : of(null),
              ),
            ),
        ),
      )
      .subscribe({
        next: () => {
          this.showCreateModal = false;
          this.submitted = false;
          this.form = this.buildForm();
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Producto registrado correctamente.',
          });
          this.loadProducts();
        },
        error: (err) => {
          console.error('Error al crear producto', err);
        },
      });
  }

  /**
   * Genera las unidades iniciales del producto usando un prefijo estable y un correlativo de tres dígitos.
   * @param {string} codigoBase - Código ingresado por el usuario para el producto.
   * @param {number} stockInicial - Cantidad inicial de unidades a crear.
   * @returns {Array<{ unitCode: string }>} Unidades listas para enviar al alta masiva.
   */
  private buildInitialUnits(
    codigoBase: string,
    stockInicial: number,
  ): Array<{ unitCode: string }> {
    const total = Number(stockInicial ?? 0);
    if (!Number.isFinite(total) || total <= 0) return [];

    const prefix = this.sanitizeUnitCode(codigoBase);
    return Array.from({ length: total }, (_, index) => ({
      unitCode: `${prefix}-${String(index + 1).padStart(3, '0')}`,
    }));
  }

  /**
   * Normaliza el código base para que pueda reutilizarse como prefijo de unidades sin caracteres inválidos.
   * @param {string} value - Texto original ingresado en el formulario.
   * @returns {string} Prefijo seguro para códigos de unidad.
   */
  private sanitizeUnitCode(value: string): string {
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]+/g, '-');

    return normalized || 'PROD';
  }

  /**
   * Construye el formulario de alta del modal con las validaciones mínimas necesarias para habilitar el guardado.
   * @returns {FormGroup} Formulario reactivo listo para crear productos.
   */
  private buildForm(): FormGroup {
    return this.fb.group({
      codigo: ['', Validators.required],
      categoria: [null, Validators.required],
      descripcion: [''],
      marca: [''],
      modelo: [''],
      precioCompra: [null, [Validators.required, Validators.min(0)]],
      precioVenta: [null, [Validators.required, Validators.min(0)]],
      stockInicial: [0, [Validators.required, Validators.min(0)]],
      estado: ['activo', Validators.required],
    });
  }
}
