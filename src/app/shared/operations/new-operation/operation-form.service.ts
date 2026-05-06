import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CreditsService } from '../../../features/seller/operations/credits.service';
import { CustomersService } from '../../../features/seller/clients/customers.service';
import { ProductUnitsService } from '../../../features/seller/products/product-units.service';
import { InterestRatesService } from '../../../features/admin/config/services/interest-rates.service';
import { ProductRatesService } from '../../../features/admin/config/services/product-rates.service';
import { InterestRate } from '../../../features/admin/config/models/interfaces/interest-rate.model';
import { ProductRate } from '../../../features/admin/config/models/interfaces/product';
import { ClientOperation } from '../../models/interface/client';
import { PaymentFrequencyOperation } from '../../models/interface/payment';
import { ProductOperation } from '../../models/interface/product';

@Injectable()
export class OperationFormService {
  private readonly customersService = inject(CustomersService);
  private readonly productUnitsService = inject(ProductUnitsService);
  private readonly creditsService = inject(CreditsService);
  private readonly interestRatesService = inject(InterestRatesService);
  private readonly productRatesService = inject(ProductRatesService);

  searchClient = signal('');
  selectedClient = signal<ClientOperation | null>(null);
  clients: ClientOperation[] = [];

  searchProduct = signal('');
  selectedType = signal<'SALE' | 'LOAN'>('SALE');
  selectedProducts = signal<ProductOperation[]>([]);
  availableProducts: ProductOperation[] = [];
  interestRates: InterestRate[] = [];
  productRates: ProductRate[] = [];

  /**
   * Lista de unidades disponibles filtrada por nombre o código según el texto del buscador.
   * @returns {ProductOperation[]} Unidades cuya etiqueta contiene el término buscado.
   */
  filteredAvailableProducts = computed(() => {
    const searchTerm = this.searchProduct().trim().toLowerCase();
    if (!searchTerm) {
      return this.availableProducts;
    }

    return this.availableProducts.filter((product) => {
      const byName = product.name.toLowerCase().includes(searchTerm);
      const byUnitCode =
        product.unitCode?.toLowerCase().includes(searchTerm) ?? false;
      return byName || byUnitCode;
    });
  });

  /**
   * Lista de clientes filtrada por DNI o nombre según el texto de búsqueda.
   * @returns {ClientOperation[]} Clientes cuyo DNI o nombre coincide con el término.
   */
  filteredClients = computed(() => {
    const searchTerm = this.searchClient().trim().toLowerCase();
    if (!searchTerm) {
      return this.clients;
    }

    return this.clients.filter((client) => {
      const byName = client.name.toLowerCase().includes(searchTerm);
      const byDni = client.dni.toLowerCase().includes(searchTerm);
      return byName || byDni;
    });
  });

  /**
   * Carga únicamente clientes para el paso 1 del wizard.
   * @returns {Observable<void>} Flujo completado cuando la lista de clientes queda en memoria.
   */
  loadClients(): Observable<void> {
    return this.customersService.list().pipe(
      map((customers) => {
        this.clients = customers.map((c) => ({
          id: c.id,
          name: c.fullName,
          dni: c.dni,
          phone: c.phone ?? '',
          email: c.email ?? '',
          status: c.status,
          previousCredits: 0,
          delinquency: 'sin mora',
          paymentCapacity: 0,
        }));
      }),
    );
  }

  /**
   * Carga tasas de interés para el flujo de préstamo (LOAN).
   * @returns {Observable<void>} Flujo completado cuando las tasas quedan en memoria.
   */
  loadLoanRates(): Observable<void> {
    return this.interestRatesService.getAll({ active: true }).pipe(
      map((rates) => {
        this.interestRates = rates;
      }),
    );
  }

  /**
   * Carga unidades disponibles para el flujo de venta (SALE).
   * Las tasas de producto se obtienen on-demand al agregar al carrito.
   * @returns {Observable<void>} Flujo completado cuando el catálogo queda en memoria.
   */
  loadSaleData(): Observable<void> {
    return this.productUnitsService.getAll({ status: 'AVAILABLE' }).pipe(
      map((units) => {
        this.availableProducts = units.map((u) => ({
          id: u.id,
          productId: u.productId,
          name: u.productName,
          price: u.currentPrice,
          stock: 1,
          unitCode: u.unitCode,
          historicalPrice: u.currentPrice,
        }));
      }),
    );
  }

  /**
   * Obtiene tasas activas para un producto específico y las guarda en memoria sin duplicados.
   * @param {string} productId - Identificador del producto para filtrar tasas.
   * @returns {Observable<ProductRate[]>} Tasas activas del producto consultado.
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

  operationTypes = [
    { label: 'Venta a Crédito', value: 'SALE' },
    { label: 'Préstamo Personal', value: 'LOAN' },
  ];

  /**
   * Actualiza el tipo de operación y limpia el estado de productos cuando es préstamo.
   * Evita arrastrar datos residuales de búsqueda o selección al flujo sin productos.
   * @param {'SALE' | 'LOAN'} type - Tipo elegido en el wizard.
   */
  setOperationType(type: 'SALE' | 'LOAN') {
    this.selectedType.set(type);

    if (type === 'LOAN') {
      this.searchProduct.set('');
      this.selectedProducts.set([]);
      this.downPayment.set(0);
    }
  }

  firstDueDate = signal<Date | undefined>(undefined);
  installmentsOptions = [
    { label: '1 cuota', value: 1 },
    { label: '3 cuotas', value: 3 },
    { label: '6 cuotas', value: 6 },
    { label: '12 cuotas', value: 12 },
  ];
  selectedInstallments = signal(6);
  interestRate = signal(15);
  loanCapital = signal(50000);
  downPayment = signal(0);
  paymentFrequencies: PaymentFrequencyOperation[] = [
    { label: 'Semanal (4 pagos/mes)', value: 'WEEKLY', factor: 4 },
    { label: 'Quincenal (2 pagos/mes)', value: 'BIWEEKLY', factor: 2 },
    { label: 'Mensual (1 pago/mes)', value: 'MONTHLY', factor: 1 },
  ];
  selectedFrequency = signal<PaymentFrequencyOperation>({
    label: 'Mensual (1 pago/mes)',
    value: 'MONTHLY',
    factor: 1,
  });
  loanMonths = signal(6);
  loanInterest = signal(10);

  checks = signal({
    identity: false,
    conditions: false,
    disbursement: false,
    capacity: false,
  });

  capital = computed(() => {
    if (this.selectedType() === 'SALE') {
      return this.selectedProducts().reduce(
        (acc, p) => acc + (p.historicalPrice ?? p.price),
        0,
      );
    }
    return this.loanCapital();
  });

  /**
   * Calcula el capital efectivamente financiado según el tipo de operación.
   * En venta descuenta el enganche y evita que el resultado sea negativo.
   * @returns {number} Monto base sobre el que se aplican intereses y cuotas.
   */
  financedCapital = computed(() => {
    const currentCapital = this.capital();

    if (this.selectedType() === 'SALE') {
      return Math.max(0, currentCapital - this.downPayment());
    }

    return currentCapital;
  });

  installmentsCount = computed(() => {
    return this.selectedInstallments();
  });

  totalToPay = computed(() => {
    const financedCapital = this.financedCapital();

    if (this.selectedType() === 'SALE') {
      return financedCapital + financedCapital * (this.interestRate() / 100);
    }

    return financedCapital + financedCapital * (this.loanInterest() / 100);
  });

  installmentValue = computed(() => {
    const count = this.installmentsCount();
    return count > 0 ? this.totalToPay() / count : 0;
  });

  /**
   * Indica si se completaron todas las declaraciones obligatorias del paso final.
   * @returns {boolean} true solo cuando las 4 casillas requeridas están marcadas.
   */
  isConfirmed = computed(() => {
    const c = this.checks();
    return c.identity && c.conditions && c.disbursement && c.capacity;
  });

  /**
   * Indica si una unidad ya fue seleccionada en el flujo de venta.
   * Evita duplicar la misma `product_unit` dentro del payload final.
   * @param {string} productId - ID real de la unidad (`product_unit.id`).
   * @returns {boolean} true cuando la unidad ya está en la selección actual.
   */
  isProductSelected(productId: string): boolean {
    return this.selectedProducts().some((product) => product.id === productId);
  }

  /**
   * Agrega una unidad disponible al listado seleccionado del flujo de venta.
   * Ignora intentos duplicados para no enviar el mismo `product_unit.id` dos veces.
   * @param {ProductOperation} product - Unidad elegida por el usuario.
   */
  addProduct(product: ProductOperation) {
    if (product.stock <= 0) {
      return;
    }

    this.selectedProducts.update((list) => {
      if (list.some((item) => item.id === product.id)) {
        return list;
      }

      return [
        ...list,
        {
          ...product,
          historicalPrice: product.historicalPrice ?? product.price,
        },
      ];
    });
  }

  /**
   * Remueve una unidad seleccionada del flujo de venta.
   * @param {ProductOperation} product - Unidad a quitar de la selección.
   */
  removeProduct(product: ProductOperation) {
    this.selectedProducts.update((list) => list.filter((p) => p !== product));
  }

  /**
   * Actualiza el estado de una casilla de confirmación del paso final.
   * @param {keyof ReturnType<typeof this.checks>} key - Clave de la casilla a modificar.
   * @param {boolean} value - Valor booleano seleccionado por el usuario.
   */
  updateCheck(key: keyof ReturnType<typeof this.checks>, value: boolean) {
    this.checks.update((c) => ({ ...c, [key]: value }));
  }

  /**
   * Devuelve la fecha actual normalizada al inicio del día local.
   * Se usa como referencia para validar que el primer pago no quede en el pasado.
   * @returns {Date} Fecha de hoy a las 00:00 local.
   */
  getTodayStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  /**
   * Normaliza una fecha al inicio del día local para evitar errores por hora/zona.
   * @param {Date} date - Fecha a normalizar.
   * @returns {Date} Fecha truncada a las 00:00 local.
   */
  normalizeToLocalDayStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /**
   * Indica si la fecha de primer pago es válida (hoy o futura).
   * @returns {boolean} true cuando hay fecha y no es anterior a hoy.
   */
  isFirstDueDateValid(): boolean {
    const dueDate = this.firstDueDate();
    if (!dueDate) return false;
    return this.normalizeToLocalDayStart(dueDate) >= this.getTodayStart();
  }

  /**
   * Indica si el cliente seleccionado está habilitado para continuar.
   * @returns {boolean} true cuando existe cliente y su estado es ACTIVE.
   */
  isSelectedClientActive(): boolean {
    return this.selectedClient()?.status === 'ACTIVE';
  }

  /**
   * Valida si el paso 2 cumple la bifurcación obligatoria de CU05.
   * @returns {boolean} true cuando SALE tiene carrito o LOAN tiene monto válido.
   */
  hasValidOperationSelection(): boolean {
    if (this.selectedType() === 'SALE') {
      return this.selectedProducts().length > 0;
    }

    return this.loanCapital() > 0;
  }

  /**
   * Valida que el enganche sea aplicable en ventas a crédito.
   * En préstamos no aplica y se considera válido por defecto.
   * @returns {boolean} true cuando el enganche está entre 0 y el capital total.
   */
  isDownPaymentValid(): boolean {
    if (this.selectedType() !== 'SALE') {
      return true;
    }

    const downPayment = this.downPayment();
    return downPayment >= 0 && downPayment <= this.capital();
  }

  /**
   * Envía la operación al backend para crearla en estado pendiente de aprobación.
   * @param {unknown} payload - estructura consolidada desde el wizard.
   * @returns {Observable<unknown>} respuesta del backend.
   */
  submitOperation(payload: unknown): Observable<unknown> {
    return this.creditsService.create(payload as never);
  }
}
