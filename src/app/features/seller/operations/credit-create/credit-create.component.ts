import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
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
import { HeaderService } from '../../../../core/services/header.service';
import { CurrencyAmountInputDirective } from '../../../../shared/directives/currency-amount-input.directive';
import { CustomersService } from '../../clients/customers.service';
import {
  CartUnit,
  CreditCreatePayload,
  SaleCreditPayload,
  PaymentFrequency,
  SimulateResult,
} from '../../models/credit.model';
import { Customer } from '../../models/customer.model';
import { CreditsService } from '../credits.service';
import { CreditCartComponent } from './credit-cart/credit-cart.component';
import { CreditSimulationComponent } from './credit-simulation/credit-simulation.component';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';

@Component({
  selector: 'app-credit-create',
  standalone: true,
  providers: [MessageService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    InputNumberModule,
    CurrencyAmountInputDirective,
    RadioButtonModule,
    InputTextareaModule,
    ToastModule,
    CreditCartComponent,
    CreditSimulationComponent,
    BackButtonComponent,
  ],
  templateUrl: './credit-create.component.html',
})
export class CreditCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly creditsService = inject(CreditsService);
  private readonly customersService = inject(CustomersService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly header = inject(HeaderService);
  private readonly messageService = inject(MessageService);

  form!: FormGroup;
  customers: Customer[] = [];
  submitting = false;
  simulating = false;
  simulateResult: SimulateResult | null = null;
  simulateError: string | null = null;
  submitError: string | null = null;
  unitsError: string | null = null;
  showExtraSection = false;

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

  get downPaymentValue(): number {
    return this.form.get('downPayment')?.value ?? 0;
  }

  get downPaymentMethod(): string {
    return this.form.get('downPaymentMethod')?.value ?? 'CASH';
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
      if (
        this.unitsError ===
        'El enganche no puede ser mayor al total de la venta.'
      ) {
        this.unitsError = null;
      }
    });
    this.loadCustomers();
  }

  /**
   * Resetea los estados relacionados con la simulación y el carrito al cambiar el tipo de crédito.
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
   * Actualiza el carrito local y limpia el estado de simulación al recibir cambios del hijo.
   * @param cart carrito actualizado
   */
  onCartChanged(cart: CartUnit[]): void {
    this.cart = cart;
    this.unitsError = null;
    this.clearSimulationState();
  }

  /**
   * Simula el crédito basado en los valores del formulario.
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
      const salePayload: SaleCreditPayload = {
        customerId: v.customerId,
        type: 'SALE',
        installmentsCount: v.installmentsCount,
        paymentFrequency: v.paymentFrequency,
        units: this.cart.map((u) => ({ unitId: u.unitId })),
        notes: v.notes || undefined,
      };
      if (v.downPayment > 0) {
        salePayload.downPayment = v.downPayment;
        salePayload.downPaymentMethod = v.downPaymentMethod;
        if (
          v.downPaymentMethod === 'TRANSFER' &&
          v.downPaymentTransferReference
        ) {
          salePayload.downPaymentTransferReference =
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
   * Navega hacia atrás en el historial del navegador.
   */
  goBack(): void {
    this.location.back();
  }

  /**
   * Verifica si un campo del formulario es inválido.
   * @param field nombre del control
   */
  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  private buildProductsForSimulate(): Array<{
    variantId: string;
    quantity: number;
  }> {
    const map = new Map<string, number>();
    for (const unit of this.cart) {
      map.set(unit.variantId, (map.get(unit.variantId) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([variantId, quantity]) => ({
      variantId,
      quantity,
    }));
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
   * Limpia el resultado y error de simulación al cambiar las condiciones.
   */
  private clearSimulationState(): void {
    this.simulateResult = null;
    this.simulateError = null;
  }

  /**
   * Valida las reglas mínimas de una venta antes de simular o crear el crédito.
   * @returns mensaje de error si la venta es inválida, null si es válida
   */
  private getSaleValidationError(): string | null {
    if (!this.isSale) return null;
    if (this.cart.length === 0) {
      return 'Agregá al menos una unidad al carrito.';
    }
    if (this.downPaymentValue > this.cartTotalSnapshot) {
      return 'El enganche no puede ser mayor al total de la venta.';
    }
    return null;
  }

  /** Suma de precios del carrito actual para validaciones en el padre. */
  private get cartTotalSnapshot(): number {
    return this.cart.reduce((sum, u) => sum + u.price, 0);
  }

  /**
   * Carga la lista de clientes activos para el selector del formulario.
   */
  private loadCustomers(): void {
    this.customersService.list({ status: 'ACTIVE' }).subscribe({
      next: (data) => (this.customers = data),
      error: () => {},
    });
  }
}
