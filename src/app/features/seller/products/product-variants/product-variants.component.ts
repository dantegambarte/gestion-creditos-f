import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { AuthServiceBase } from '../../../../core/auth/auth-service.base';
import { AppError } from '../../../../core/models/app-error';
import { UserRoleEnum } from '../../../../core/models/types/user-role';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import { HeaderService } from '../../../../core/services/header.service';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import { CurrencyAmountInputDirective } from '../../../../shared/directives/currency-amount-input.directive';
import { ProductVariant } from '../../models/product-variant.model';
import { ProductVariantsService } from '../product-variants.service';
import { ProductsService } from '../products.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-product-variants',
  standalone: true,
  providers: [MessageService, ConfirmationService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    TableModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    CurrencyAmountInputDirective,
    CurrencyArsPipe,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  templateUrl: './product-variants.component.html',
})
export class ProductVariantsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly fb = inject(FormBuilder);
  private readonly productsService = inject(ProductsService);
  private readonly variantsService = inject(ProductVariantsService);
  private readonly auth = inject(AuthServiceBase);
  private readonly header = inject(HeaderService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  variants: ProductVariant[] = [];
  loading = false;
  error: AppError | null = null;
  productName = '';

  showDialog = false;
  showPanel = false;
  editingVariant: ProductVariant | null = null;
  dialogSubmitting = false;
  dialogError: string | null = null;
  form!: FormGroup;
  entryMode: 'individual' | 'bulk' = 'individual';
  bulkRows: Array<{ color: string; size: string; capacity: string; currentPrice: number | null; initialUnits: number | null }> = [];
  bulkSubmitting = false;
  bulkError: string | null = null;
  bulkRowErrors: Record<number, Partial<Record<'color' | 'size' | 'capacity' | 'currentPrice' | 'attributes', string>>> = {};
  expandedVariantId: string | null = null;

  get isAdmin(): boolean {
    return this.auth.hasRole(UserRoleEnum.ADMIN);
  }

  get hasColor(): boolean {
    return this.variants.some((v) => !!v.color);
  }
  get hasSize(): boolean {
    return this.variants.some((v) => !!v.size);
  }
  get hasCapacity(): boolean {
    return this.variants.some((v) => !!v.capacity);
  }

  private get productId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit(): void {
    this.header.set([
      { label: 'Productos', route: `/${this.routePrefix}/products` },
      { label: 'Variantes' },
    ]);
    this.buildForm();
    this.loadProduct();
    this.loadVariants();
  }

  // TODO: agregar documentacion de las funciones

  goBack(): void {
    this.location.back();
  }

  /**
   * Devuelve un resumen legible de los atributos de la variante (color, talle, capacidad).
   * @param v - Variante del producto.
   */
  variantSummary(v: ProductVariant): string {
    const parts = [v.color, v.size, v.capacity].filter((s) => !!s);
    return parts.length > 0 ? parts.join(' · ') : 'Estándar';
  }

  /**
   * Abre el panel en modo alta individual y reinicia el formulario.
   */
  openCreate(): void {
    this.editingVariant = null;
    this.form.reset({ currentPrice: null, initialUnits: 1 });
    this.dialogError = null;
    this.showDialog = true;
    this.showPanel = true;
    this.entryMode = 'individual';
    this.resetBulkRows();
  }

  openEdit(variant: ProductVariant): void {
    this.editingVariant = variant;
    this.form.patchValue({
      color: variant.color ?? '',
      size: variant.size ?? '',
      capacity: variant.capacity ?? '',
      currentPrice: variant.currentPrice,
      initialUnits: 0,
    });
    this.dialogError = null;
    this.showDialog = true;
    this.showPanel = true;
  }

  /** Cierra el panel lateral de creación/edición. */
  closePanel(): void {
    this.showPanel = false;
    this.showDialog = false;
    this.editingVariant = null;
    this.form.reset({ currentPrice: null, initialUnits: 1 });
    this.dialogError = null;
    this.entryMode = 'individual';
    this.resetBulkRows();
  }

  /**
   * Cambia entre ingreso individual y múltiple limpiando errores de UI.
   * @param {'individual'|'bulk'} mode - Modo seleccionado por el usuario.
   */
  setEntryMode(mode: 'individual' | 'bulk'): void {
    this.entryMode = mode;
    this.dialogError = null;
    this.bulkError = null;
    this.bulkRowErrors = {};
    if (mode === 'bulk' && this.bulkRows.length === 0) {
      this.resetBulkRows();
    }
  }

  /**
   * Guarda la variante según el modo activo (individual o múltiple).
   */
  saveDialog(): void {
    if (this.entryMode === 'bulk') {
      this.saveBulk();
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.dialogSubmitting = true;
    this.dialogError = null;

    if (this.editingVariant) {
      this.variantsService
        .update(this.editingVariant.id, {
          color: v.color || undefined,
          size: v.size || undefined,
          capacity: v.capacity || undefined,
          currentPrice: v.currentPrice,
        })
        .subscribe({
          next: () => {
            this.dialogSubmitting = false;
            this.showDialog = false;
            this.messageService.add({
              severity: 'success',
              summary: 'Variante actualizada',
            });
            this.loadVariants();
          },
          error: (err: AppError) => {
            this.dialogSubmitting = false;
            this.dialogError = err.message;
          },
        });
    } else {
      this.variantsService
        .create({
          productId: this.productId,
          color: v.color || undefined,
          size: v.size || undefined,
          capacity: v.capacity || undefined,
          currentPrice: v.currentPrice,
          initialUnits: v.initialUnits ?? 1,
        })
        .subscribe({
          next: () => {
            this.dialogSubmitting = false;
            this.showDialog = false;
            this.messageService.add({
              severity: 'success',
              summary: 'Variante creada',
            });
            this.loadVariants();
          },
          error: (err: AppError) => {
            this.dialogSubmitting = false;
            this.dialogError = err.message;
            if (err.status === 409) {
              this.messageService.add({
                severity: 'warn',
                summary: 'Variante duplicada',
                detail: err.message,
                life: 5000,
              });
            }
          },
        });
    }
  }

  /**
   * Agrega una fila vacía para el ingreso múltiple de variantes.
   */
  addBulkRow(): void {
    this.bulkRows.push({ color: '', size: '', capacity: '', currentPrice: null, initialUnits: 1 });
  }

  /**
   * Quita una fila por índice y reindexa los errores mostrados.
   * @param {number} index - Posición de la fila a eliminar.
   */
  removeBulkRow(index: number): void {
    this.bulkRows.splice(index, 1);
    this.reindexBulkErrors(index);
  }

  /**
   * Envía el lote de variantes y mapea errores de backend por fila/campo.
   */
  async saveBulk(): Promise<void> {
    this.bulkError = null;

    // Filas con al menos un campo completado — se ignoran las completamente vacías
    const filledEntries = this.bulkRows
      .map((row, originalIndex) => ({ originalIndex, row }))
      .filter(({ row }) =>
        row.color?.trim() || row.size?.trim() || row.capacity?.trim() ||
        (row.currentPrice !== null && row.currentPrice !== undefined),
      );

    if (filledEntries.length === 0) {
      this.bulkRowErrors = {};
      this.bulkError = 'Cargá al menos una fila con datos antes de confirmar.';
      return;
    }

    const rowsToValidate = filledEntries.map(({ row }) => ({
      color: row.color?.trim() || undefined,
      size: row.size?.trim() || undefined,
      capacity: row.capacity?.trim() || undefined,
      currentPrice: row.currentPrice ?? undefined,
      initialUnits: row.initialUnits ?? 1,
    }));

    // Remapear errores de validación de índice-filtrado a índice-original
    const localErrorsByFilteredIndex = this.buildLocalBulkErrors(rowsToValidate);
    const mappedErrors: typeof this.bulkRowErrors = {};
    Object.entries(localErrorsByFilteredIndex).forEach(([key, value]) => {
      const originalIndex = filledEntries[Number(key)]?.originalIndex;
      if (originalIndex !== undefined) mappedErrors[originalIndex] = value;
    });

    this.bulkRowErrors = mappedErrors;
    if (Object.keys(mappedErrors).length > 0) {
      this.bulkError = 'Revisá los campos marcados en rojo.';
      return;
    }

    const rowsToSend = rowsToValidate;

    this.bulkSubmitting = true;

    const successOriginalIndexes: number[] = [];
    const apiErrors: Array<{ row: number; field: string; message: string }> = [];

    for (let i = 0; i < rowsToSend.length; i += 1) {
      const row = rowsToSend[i];
      const originalIndex = filledEntries[i].originalIndex;
      try {
        await firstValueFrom(
          this.variantsService.create({
            productId: this.productId,
            color: row.color,
            size: row.size,
            capacity: row.capacity,
            currentPrice: row.currentPrice as number,
            initialUnits: row.initialUnits ?? 1,
          }),
        );
        successOriginalIndexes.push(originalIndex);
      } catch (rawErr) {
        const err = rawErr as AppError;
        apiErrors.push({
          row: originalIndex,
          field: 'attributes',
          message: err.message || 'No se pudo crear la variante.',
        });
      }
    }

    this.bulkSubmitting = false;

    if (successOriginalIndexes.length > 0) {
      this.bulkRows = this.bulkRows.filter((_, index) => !successOriginalIndexes.includes(index));
      this.reindexBulkErrorsByRemovedIndexes(successOriginalIndexes);
      this.loadVariants();
    }

    if (apiErrors.length > 0) {
      this.bulkRowErrors = {};
      this.mapBulkErrors(apiErrors);
      this.bulkError =
        successOriginalIndexes.length > 0
          ? `${successOriginalIndexes.length} variante(s) creada(s). Corregí las filas con error.`
          : 'No se pudo crear ninguna variante. Revisá las filas marcadas.';
      return;
    }

    this.bulkRowErrors = {};
    this.bulkError = null;
    this.messageService.add({
      severity: 'success',
      summary: `Se crearon ${successOriginalIndexes.length} variantes`,
    });

    if (this.bulkRows.length === 0) {
      this.addBulkRow();
    }
  }

  /**
   * Limpia errores de una fila al editar para evitar mensajes obsoletos.
   * @param {number} rowIndex - Índice original de la fila en UI.
   */
  onBulkRowChange(rowIndex: number): void {
    if (!this.bulkRowErrors[rowIndex]) return;
    delete this.bulkRowErrors[rowIndex];
    if (Object.keys(this.bulkRowErrors).length === 0) {
      this.bulkError = null;
    }
  }

  /**
   * Devuelve un error de campo para una fila del ingreso múltiple.
   * @param {number} rowIndex - Índice de fila.
   * @param {'color'|'size'|'capacity'|'currentPrice'|'attributes'} field - Campo visual.
   * @returns {string | null} Mensaje de error si existe.
   */
  getBulkFieldError(
    rowIndex: number,
    field: 'color' | 'size' | 'capacity' | 'currentPrice' | 'attributes',
  ): string | null {
    return this.bulkRowErrors[rowIndex]?.[field] || null;
  }

  /**
   * Cuenta cuántas filas tienen al menos un valor cargado.
   * @returns {number} Total de filas completas o parciales a enviar.
   */
  getBulkFilledRowsCount(): number {
    return this.bulkRows.filter(
      (row) =>
        Boolean(row.color?.trim()) ||
        Boolean(row.size?.trim()) ||
        Boolean(row.capacity?.trim()) ||
        row.currentPrice !== null,
    ).length;
  }

  /**
   * Define si el botón confirmar debe estar habilitado.
   * @returns {boolean} True cuando hay al menos una fila con datos y no se está enviando.
   */
  canSubmitBulk(): boolean {
    return this.getBulkFilledRowsCount() > 0 && !this.bulkSubmitting;
  }

  /**
   * Alterna la expansión de una variante en la grilla.
   * @param {ProductVariant} variant - Variante objetivo del toggle.
   */
  toggleVariantExpanded(variant: ProductVariant): void {
    this.expandedVariantId = this.expandedVariantId === variant.id ? null : variant.id;
  }

  /**
   * Informa si una variante está expandida en la tabla.
   * @param {ProductVariant} variant - Variante a evaluar.
   * @returns {boolean} True cuando la fila está desplegada.
   */
  isVariantExpanded(variant: ProductVariant): boolean {
    return this.expandedVariantId === variant.id;
  }

  /**
   * Indica si el ingreso múltiple está visible en el panel lateral.
   * @returns {boolean} True cuando el panel está abierto y en modo múltiple.
   */
  isBulkModeActive(): boolean {
    return this.showPanel && this.entryMode === 'bulk';
  }

  /**
   * Suma el precio unitario de las filas cargadas en ingreso múltiple.
   * @returns {number} Total de precios unitarios ingresados.
   */
  getBulkTotalPrice(): number {
    return this.bulkRows.reduce((acc, row) => {
      const hasAnyValue = Boolean(row.color?.trim()) || Boolean(row.size?.trim()) || Boolean(row.capacity?.trim()) || row.currentPrice !== null;
      if (!hasAnyValue || row.currentPrice === null || row.currentPrice === undefined) return acc;
      return acc + Number(row.currentPrice);
    }, 0);
  }

  /**
   * Calcula el valor total (precio x unidades) de las filas cargadas.
   * @returns {number} Importe total del lote según precios y unidades.
   */
  getBulkEstimatedTotal(): number {
    return this.bulkRows.reduce((acc, row) => {
      const hasAnyValue = Boolean(row.color?.trim()) || Boolean(row.size?.trim()) || Boolean(row.capacity?.trim()) || row.currentPrice !== null;
      if (!hasAnyValue || row.currentPrice === null || row.currentPrice === undefined) return acc;
      const units = row.initialUnits ?? 1;
      return acc + Number(row.currentPrice) * Number(units);
    }, 0);
  }

  /**
   * Suma las unidades iniciales de las filas con datos cargados.
   * @returns {number} Cantidad total de unidades a crear.
   */
  getBulkTotalUnits(): number {
    return this.bulkRows.reduce((acc, row) => {
      const hasAnyValue = Boolean(row.color?.trim()) || Boolean(row.size?.trim()) || Boolean(row.capacity?.trim()) || row.currentPrice !== null;
      if (!hasAnyValue) return acc;
      const units = row.initialUnits ?? 1;
      return acc + Number(units);
    }, 0);
  }

  confirmDeactivate(variant: ProductVariant): void {
    this.confirmationService.confirm({
      header: 'Desactivar variante',
      message: `¿Desactivar variante <strong>${variant.color ?? ''} ${variant.size ?? ''} ${variant.capacity ?? ''}</strong>?`,
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass:
        'p-button-danger p-button-outlined h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.variantsService.deactivate(variant.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Variante desactivada',
            });
            this.loadVariants();
          },
          error: (err: AppError) => this.handleError(err),
        }),
    });
  }

  confirmActivate(variant: ProductVariant): void {
    this.confirmationService.confirm({
      header: 'Activar variante',
      message: '¿Activar esta variante?',
      acceptLabel: 'Activar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.variantsService.activate(variant.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Variante activada',
            });
            this.loadVariants();
          },
          error: (err: AppError) => this.handleError(err),
        }),
    });
  }

  navigateToUnits(variant: ProductVariant): void {
    this.router.navigate([
      `/${this.routePrefix}/products`,
      this.productId,
      'variants',
      variant.id,
      'units',
    ]);
  }

  private get routePrefix(): string {
    return this.router.url.startsWith('/admin') ? 'admin' : 'seller';
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  private buildForm(): void {
    this.form = this.fb.group({
      color: [''],
      size: [''],
      capacity: [''],
      currentPrice: [null, [Validators.required, Validators.min(0.01)]],
      initialUnits: [1, [Validators.required, Validators.min(0)]],
    });
  }

  /**
   * Inicializa las filas por defecto del ingreso múltiple.
   */
  private resetBulkRows(): void {
    this.bulkRows = [
      { color: '', size: '', capacity: '', currentPrice: null, initialUnits: 1 },
      { color: '', size: '', capacity: '', currentPrice: null, initialUnits: 1 },
      { color: '', size: '', capacity: '', currentPrice: null, initialUnits: 1 },
    ];
    this.bulkRowErrors = {};
    this.bulkError = null;
  }

  /**
   * Valida en frontend cada fila cargada para evitar roundtrip innecesario.
   * @param {Array<{color?:string,size?:string,capacity?:string,currentPrice?:number}>} rows - Filas normalizadas.
   * @returns {Record<number, Partial<Record<'color'|'size'|'capacity'|'currentPrice'|'attributes', string>>>} Errores por fila/campo.
   */
  private buildLocalBulkErrors(
    rows: Array<{ color?: string; size?: string; capacity?: string; currentPrice?: number; initialUnits?: number }>,
  ): Record<number, Partial<Record<'color' | 'size' | 'capacity' | 'currentPrice' | 'attributes', string>>> {
    const next: Record<
      number,
      Partial<Record<'color' | 'size' | 'capacity' | 'currentPrice' | 'attributes', string>>
    > = {};
    const seen = new Map<string, number>();

    rows.forEach((row, index) => {
      const color = row.color?.trim() || '';
      const size = row.size?.trim() || '';
      const capacity = row.capacity?.trim() || '';
      const price = row.currentPrice;
      const initialUnits = row.initialUnits;

      if (!color && !size && !capacity) {
        next[index] = {
          ...(next[index] || {}),
          attributes: 'Completá al menos color, talle o capacidad.',
        };
      }

      if (price === undefined || price === null || Number(price) < 0.01) {
        next[index] = {
          ...(next[index] || {}),
          currentPrice: 'El precio es obligatorio y debe ser mayor a 0.',
        };
      }

      if (initialUnits === undefined || initialUnits === null || !Number.isInteger(Number(initialUnits)) || Number(initialUnits) < 0) {
        next[index] = {
          ...(next[index] || {}),
          attributes: 'Initial units debe ser un entero mayor o igual a 0.',
        };
      }

      const signature = `${color}|${size}|${capacity}`;
      if (seen.has(signature)) {
        next[index] = {
          ...(next[index] || {}),
          attributes: 'Esta combinación está repetida en el lote.',
        };
      } else {
        seen.set(signature, index);
      }
    });

    return next;
  }

  /**
   * Mapea errores de backend al formato visual por fila y campo.
   * @param {unknown} rawErrors - Estructura libre devuelta por la API.
   * @param {number[]} originalIndexMap - Mapa de índice-filtrado → índice-original en UI.
   */
  private mapBulkErrors(rawErrors: unknown, originalIndexMap: number[] = []): void {
    if (!Array.isArray(rawErrors)) return;

    for (const entry of rawErrors) {
      if (!entry || typeof entry !== 'object') continue;
      const filteredRow = Number((entry as { row?: unknown }).row);
      const field = String((entry as { field?: unknown }).field || 'attributes');
      const message = String((entry as { message?: unknown }).message || 'Dato inválido.');

      if (!Number.isInteger(filteredRow) || filteredRow < 0) continue;

      const row = originalIndexMap.length > 0
        ? (originalIndexMap[filteredRow] ?? filteredRow)
        : filteredRow;

      this.bulkRowErrors[row] = this.bulkRowErrors[row] || {};
      if (field === 'current_price') {
        this.bulkRowErrors[row].currentPrice = message;
      } else if (field === 'color' || field === 'size' || field === 'capacity') {
        this.bulkRowErrors[row][field as 'color' | 'size' | 'capacity'] = message;
      } else {
        this.bulkRowErrors[row].attributes = message;
      }
    }
  }

  /**
   * Reindexa errores cuando se elimina una fila intermedia.
   * @param {number} removedIndex - Índice eliminado.
   */
  private reindexBulkErrors(removedIndex: number): void {
    const next: typeof this.bulkRowErrors = {};
    for (const [rawKey, value] of Object.entries(this.bulkRowErrors)) {
      const key = Number(rawKey);
      if (key < removedIndex) next[key] = value;
      if (key > removedIndex) next[key - 1] = value;
    }
    this.bulkRowErrors = next;
  }

  /**
   * Reindexa errores cuando se eliminan múltiples filas exitosas.
   * @param {number[]} removedIndexes - Índices originales eliminados.
   */
  private reindexBulkErrorsByRemovedIndexes(removedIndexes: number[]): void {
    if (removedIndexes.length === 0) return;
    const sorted = [...removedIndexes].sort((a, b) => a - b);
    const next: typeof this.bulkRowErrors = {};

    for (const [rawKey, value] of Object.entries(this.bulkRowErrors)) {
      const key = Number(rawKey);
      if (sorted.includes(key)) continue;
      const shift = sorted.filter((idx) => idx < key).length;
      next[key - shift] = value;
    }

    this.bulkRowErrors = next;
  }

  private loadProduct(): void {
    this.productsService.getById(this.productId).subscribe({
      next: (p) => {
        this.productName = p.title;
        this.header.set([
          { label: 'Productos', route: `/${this.routePrefix}/products` },
          {
            label: p.title,
            route: `/${this.routePrefix}/products/${this.productId}`,
          },
          { label: 'Variantes' },
        ]);
      },
      error: () => {},
    });
  }

  private loadVariants(): void {
    this.loading = true;
    this.error = null;
    this.variantsService.getAll({ productId: this.productId }).subscribe({
      next: (data) => {
        this.variants = data;
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }

  private handleError(err: AppError): void {
    this.messageService.add({
      severity: err.status === 409 ? 'warn' : 'error',
      summary: err.status === 409 ? 'Conflicto' : 'Error',
      detail: err.message,
    });
  }
}
