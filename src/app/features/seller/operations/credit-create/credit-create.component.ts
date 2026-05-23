import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ToastModule } from 'primeng/toast';
import { AppError } from '../../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import { HeaderService } from '../../../../core/services/header.service';
import { CurrencyAmountInputDirective } from '../../../../shared/directives/currency-amount-input.directive';
import { CustomersService } from '../../clients/customers.service';
import {
  CartUnit,
  CreditCreatePayload,
  PaymentFrequency,
  SimulateResult,
} from '../../models/credit.model';
import { Customer } from '../../models/customer.model';
import { ProductUnit } from '../../models/product-unit.model';
import { ProductVariant } from '../../models/product-variant.model';
import { Product } from '../../models/product.model';
import { ProductUnitsService } from '../../products/product-units.service';
import { ProductVariantsService } from '../../products/product-variants.service';
import { ProductsService } from '../../products/products.service';
import { CreditsService } from '../credits.service';

@Component({
  selector: 'app-credit-create',
  standalone: true,
  providers: [MessageService],
  imports: [
    CurrencyArsPipe,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    InputNumberModule,
    CurrencyAmountInputDirective,
    RadioButtonModule,
    InputTextareaModule,
    ToastModule,
  ],
  templateUrl: './credit-create.component.html',
})
export class CreditCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly creditsService = inject(CreditsService);
  private readonly customersService = inject(CustomersService);
  private readonly productsService = inject(ProductsService);
  private readonly variantsService = inject(ProductVariantsService);
  private readonly unitsService = inject(ProductUnitsService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly header = inject(HeaderService);
  private readonly messageService = inject(MessageService);

  form!: FormGroup;
  customers: Customer[] = [];
  products: Product[] = [];
  submitting = false;
  simulating = false;
  simulateResult: SimulateResult | null = null;
  simulateError: string | null = null;
  submitError: string | null = null;
  unitsError: string | null = null;
  showExtraSection = false;

  selectorProducts: Product[] = [];
  selectorVariants: ProductVariant[] = [];
  selectorUnits: ProductUnit[] = [];
  selectedProductId = '';
  selectedVariantId = '';
  selectedUnitId = '';
  loadingVariants = false;
  loadingUnits = false;

  cart: CartUnit[] = [];

  readonly frequencyOptions = [
    { label: 'Semanal', value: 'WEEKLY' },
    { label: 'Quincenal', value: 'BIWEEKLY' },
    { label: 'Mensual', value: 'MONTHLY' },
  ];

  readonly paymentMethodOptions = [
    { label: 'Efectivo', value: 'CASH' },
    { label: 'Transferencia', value: 'TRANSFER' },
  ];

  get creditType(): string {
    return this.form.get('type')?.value ?? 'SALE';
  }

  get isSale(): boolean {
    return this.creditType === 'SALE';
  }

  get customerOptions(): { label: string; value: string }[] {
    return this.customers.map((c) => ({
      label: `${c.fullName} (${c.dni})`,
      value: c.id,
    }));
  }

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

  get downPaymentValue(): number {
    return this.form.get('downPayment')?.value ?? 0;
  }

  get downPaymentMethod(): string {
    return this.form.get('downPaymentMethod')?.value ?? 'CASH';
  }

  get cartTotal(): number {
    return this.cart.reduce((sum, u) => sum + u.price, 0);
  }

  get financedAmountPreview(): number {
    return Math.max(this.cartTotal - this.downPaymentValue, 0);
  }

  /**
   * Inicializa el formulario y carga los catálogos necesarios para crear créditos.
   */
  ngOnInit(): void {
    this.header.set([
      { label: 'Operaciones', route: '/seller/operations' },
      { label: 'Nueva operación' },
    ]);
    this.buildForm();
    this.form.get('downPayment')?.valueChanges.subscribe(() => {
      this.clearSimulationState();
      if (this.unitsError === 'El enganche no puede ser mayor al total de la venta.') {
        this.unitsError = null;
      }
    });
    this.loadCustomers();
    this.productsService.list({ status: 'ACTIVE' }).subscribe({
      next: (data) => (this.selectorProducts = data),
      error: () => {},
    });
  }

  /**
   * Resetea los estados relacionados con la simulación y el carrito cada vez que se cambia el tipo de crédito, para asegurar que la información mostrada sea relevante al tipo seleccionado y evitar inconsistencias en la interfaz. Esto incluye limpiar los resultados de simulación anteriores, errores, y vaciar el carrito, además de ocultar secciones adicionales que solo aplican a ciertos tipos de crédito.
   */
  onTypeChange(newType: string): void {
    this.simulateResult = null;
    this.simulateError = null;
    this.submitError = null;
    this.unitsError = null;
    this.showExtraSection = false;
    this.form.patchValue({
      downPayment: 0,
      downPaymentMethod: 'CASH',
      downPaymentTransferReference: '',
    });
    const totalAmount = this.form.get('totalAmount');
    if (newType === 'LOAN') {
      totalAmount?.setValidators([Validators.required, Validators.min(1)]);
    } else {
      totalAmount?.clearValidators();
      totalAmount?.setValue(null);
    }
    totalAmount?.updateValueAndValidity();
  }

  /**
   * Maneja la selección de un producto, cargando sus variantes y unidades disponibles.
   * @returns
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
   * Maneja la selección de una variante, cargando las unidades disponibles.
   * @returns
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
   * Agrega una unidad al carrito.
   * @returns
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
    this.unitsError = null;
    this.clearSimulationState();
  }

  /**
   * Elimina una unidad del carrito.
   * @param index
   */
  removeFromCart(index: number): void {
    this.cart.splice(index, 1);
    this.clearSimulationState();
  }

  /**
   * Simula el crédito basado en los valores del formulario.
   * @returns
   */
  simulate(): void {
    const v = this.form.getRawValue();
    if (!v.installmentsCount || !v.paymentFrequency) return;
    if (v.type === 'SALE' && this.cart.length === 0) return;

    const saleValidationError = this.getSaleValidationError();
    if (saleValidationError) {
      this.unitsError = saleValidationError;
      this.simulateResult = null;
      return;
    }

    this.simulating = true;
    this.simulateResult = null;
    this.simulateError = null;
    this.unitsError = null;

    const payload =
      v.type === 'SALE'
        ? {
            type: 'SALE' as const,
            products: this.buildProductsForSimulate(),
            installmentsCount: v.installmentsCount,
            paymentFrequency: v.paymentFrequency as PaymentFrequency,
            ...(v.downPayment > 0 ? { downPayment: v.downPayment } : {}),
          }
        : {
            type: 'LOAN' as const,
            totalAmount: v.totalAmount,
            installmentsCount: v.installmentsCount,
            paymentFrequency: v.paymentFrequency as PaymentFrequency,
          };

    this.creditsService.simulate(payload).subscribe({
      next: (result) => {
        this.simulateResult = result;
        this.simulating = false;
      },
      error: (err: AppError) => {
        this.simulateError = err.message;
        this.simulating = false;
      },
    });
  }

  /**
   * Maneja el envío del formulario de creación de crédito.
   * @returns
   */
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.isSale && this.cart.length === 0) {
      this.unitsError = 'Agregá al menos una unidad al carrito.';
      return;
    }

    const saleValidationError = this.getSaleValidationError();
    if (saleValidationError) {
      this.unitsError = saleValidationError;
      return;
    }

    const v = this.form.getRawValue();
    let payload: CreditCreatePayload;

    if (v.type === 'SALE') {
      const salePayload: CreditCreatePayload = {
        customerId: v.customerId,
        type: 'SALE',
        installmentsCount: v.installmentsCount,
        paymentFrequency: v.paymentFrequency,
        units: this.cart.map((u) => ({ unitId: u.unitId })),
        notes: v.notes || undefined,
      };
      if (v.downPayment > 0) {
        (salePayload as any).downPayment = v.downPayment;
        (salePayload as any).downPaymentMethod = v.downPaymentMethod;
        if (
          v.downPaymentMethod === 'TRANSFER' &&
          v.downPaymentTransferReference
        ) {
          (salePayload as any).downPaymentTransferReference =
            v.downPaymentTransferReference;
        }
      }
      payload = salePayload;
    } else {
      payload = {
        customerId: v.customerId,
        type: 'LOAN',
        totalAmount: v.totalAmount,
        installmentsCount: v.installmentsCount,
        paymentFrequency: v.paymentFrequency,
        notes: v.notes || undefined,
      };
    }

    this.submitting = true;
    this.submitError = null;
    this.unitsError = null;

    this.creditsService.create(payload).subscribe({
      next: (result) => {
        this.submitting = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Operación registrada',
          detail: 'Pre-operación registrada. Pendiente de aprobación.',
        });
        setTimeout(
          () => this.router.navigate(['/seller/operations', result.id]),
          1500,
        );
      },
      error: (err: AppError) => {
        this.submitting = false;
        if (err.status === 409 || err.status === 400) {
          this.unitsError = err.message;
        } else {
          this.submitError = err.message;
        }
      },
    });
  }

  /**
   * Navega hacia atrás en el historial del navegador, regresando a la página anterior. Esto es útil para permitir al usuario volver fácilmente a la lista de operaciones o a la página desde donde accedió al formulario de creación de crédito, mejorando la navegación y experiencia del usuario dentro de la aplicación.
   */
  goBack(): void {
    this.location.back();
  }

  /**
   * Verifica si un campo del formulario es inválido.
   * @param field
   * @returns
   */
  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  private buildProductsForSimulate(): Array<{ variantId: string; quantity: number }> {
    const map = new Map<string, number>();
    for (const unit of this.cart) {
      map.set(unit.variantId, (map.get(unit.variantId) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([variantId, quantity]) => ({ variantId, quantity }));
  }

  private buildForm(): void {
    this.form = this.fb.group({
      type: ['SALE'],
      customerId: ['', Validators.required],
      paymentFrequency: ['', Validators.required],
      installmentsCount: [
        1,
        [Validators.required, Validators.min(1), Validators.max(120)],
      ],
      notes: ['', Validators.maxLength(500)],
      totalAmount: [null],
      downPayment: [0, [Validators.min(0)]],
      downPaymentMethod: ['CASH'],
      downPaymentTransferReference: ['', Validators.maxLength(100)],
    });
  }

  /**
   * Limpia la simulación actual cuando cambian las condiciones de una venta.
   */
  private clearSimulationState(): void {
    this.simulateResult = null;
    this.simulateError = null;
  }

  /**
   * Valida las reglas mínimas de una venta antes de simular o crear el crédito.
   * @returns {string | null} Mensaje de error si la venta es inválida.
   */
  private getSaleValidationError(): string | null {
    if (!this.isSale) return null;
    if (this.cart.length === 0) {
      return 'Agregá al menos una unidad al carrito.';
    }
    if (this.downPaymentValue > this.cartTotal) {
      return 'El enganche no puede ser mayor al total de la venta.';
    }
    return null;
  }

  /**
   * Carga la lista de clientes activos desde el servicio de clientes y los asigna a la propiedad `customers`. Si ocurre un error durante la carga, simplemente se ignora y no se muestran clientes en el selector, lo que permite que la aplicación siga funcionando aunque no se puedan cargar los clientes por alguna razón (como un error de red). Esta función se llama al inicializar el componente para asegurar que el selector de clientes esté poblado con las opciones disponibles.
   */
  private loadCustomers(): void {
    this.customersService.list({ status: 'ACTIVE' }).subscribe({
      next: (data) => (this.customers = data),
      error: () => {},
    });
  }
}
