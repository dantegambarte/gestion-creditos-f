import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { firstValueFrom } from 'rxjs';
import { AppError } from '../../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import { CurrencyAmountInputDirective } from '../../../../shared/directives/currency-amount-input.directive';
import { ProductVariantsService } from '../product-variants.service';

type BulkRow = {
  color: string;
  size: string;
  capacity: string;
  currentPrice: number | null;
  initialUnits: number | null;
};
type BulkFieldKey =
  | 'color'
  | 'size'
  | 'capacity'
  | 'currentPrice'
  | 'attributes';
type BulkRowErrors = Record<number, Partial<Record<BulkFieldKey, string>>>;

@Component({
  selector: 'app-bulk-variant-entry',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    CurrencyAmountInputDirective,
    CurrencyArsPipe,
  ],
  templateUrl: './bulk-variant-entry.component.html',
})
export class BulkVariantEntryComponent implements OnInit {
  @Input() productId!: string;
  /** Emite cuando se crearon variantes con éxito para que el padre recargue la lista. */
  @Output() variantsCreated = new EventEmitter<void>();

  bulkRows: BulkRow[] = [];
  bulkSubmitting = false;
  bulkError: string | null = null;
  bulkRowErrors: BulkRowErrors = {};

  private readonly variantsService = inject(ProductVariantsService);
  private readonly msg = inject(MessageService);

  ngOnInit(): void {
    this.resetBulkRows();
  }

  /**
   * Agrega una fila vacía para el ingreso múltiple de variantes.
   */
  addBulkRow(): void {
    this.bulkRows.push({
      color: '',
      size: '',
      capacity: '',
      currentPrice: null,
      initialUnits: 1,
    });
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
   * @param {BulkFieldKey} field - Campo visual.
   * @returns {string | null} Mensaje de error si existe.
   */
  getBulkFieldError(rowIndex: number, field: BulkFieldKey): string | null {
    return this.bulkRowErrors[rowIndex]?.[field] || null;
  }

  /**
   * Cuenta cuántas filas tienen al menos un valor cargado.
   * @returns {number} Total de filas completas o parciales a enviar.
   */
  getBulkFilledRowsCount(): number {
    return this.bulkRows.filter((row) => this.isRowFilled(row)).length;
  }

  /**
   * Define si el botón confirmar debe estar habilitado.
   * @returns {boolean} True cuando hay al menos una fila con datos y no se está enviando.
   */
  canSubmitBulk(): boolean {
    return this.getBulkFilledRowsCount() > 0 && !this.bulkSubmitting;
  }

  /**
   * Suma el precio unitario de las filas cargadas en ingreso múltiple.
   * @returns {number} Total de precios unitarios ingresados.
   */
  getBulkTotalPrice(): number {
    return this.bulkRows.reduce((acc, row) => {
      if (!this.isRowFilled(row) || row.currentPrice === null || row.currentPrice === undefined)
        return acc;
      return acc + Number(row.currentPrice);
    }, 0);
  }

  /**
   * Calcula el valor total (precio x unidades) de las filas cargadas.
   * @returns {number} Importe total del lote según precios y unidades.
   */
  getBulkEstimatedTotal(): number {
    return this.bulkRows.reduce((acc, row) => {
      if (!this.isRowFilled(row) || row.currentPrice === null || row.currentPrice === undefined)
        return acc;
      return acc + Number(row.currentPrice) * Number(row.initialUnits ?? 1);
    }, 0);
  }

  /**
   * Suma las unidades iniciales de las filas con datos cargados.
   * @returns {number} Cantidad total de unidades a crear.
   */
  getBulkTotalUnits(): number {
    return this.bulkRows.reduce((acc, row) => {
      if (!this.isRowFilled(row)) return acc;
      return acc + Number(row.initialUnits ?? 1);
    }, 0);
  }

  /**
   * Envía el lote de variantes y mapea errores de backend por fila/campo.
   */
  async saveBulk(): Promise<void> {
    this.bulkError = null;

    const filledEntries = this.bulkRows
      .map((row, originalIndex) => ({ originalIndex, row }))
      .filter(
        ({ row }) =>
          row.color?.trim() ||
          row.size?.trim() ||
          row.capacity?.trim() ||
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

    const localErrorsByFilteredIndex =
      this.buildLocalBulkErrors(rowsToValidate);
    const mappedErrors: BulkRowErrors = {};
    Object.entries(localErrorsByFilteredIndex).forEach(([key, value]) => {
      const originalIndex = filledEntries[Number(key)]?.originalIndex;
      if (originalIndex !== undefined) mappedErrors[originalIndex] = value;
    });

    this.bulkRowErrors = mappedErrors;
    if (Object.keys(mappedErrors).length > 0) {
      this.bulkError = 'Revisá los campos marcados en rojo.';
      return;
    }

    this.bulkSubmitting = true;

    const successOriginalIndexes: number[] = [];
    const apiErrors: Array<{ row: number; field: string; message: string }> =
      [];

    for (let i = 0; i < rowsToValidate.length; i += 1) {
      const row = rowsToValidate[i];
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
      this.bulkRows = this.bulkRows.filter(
        (_, index) => !successOriginalIndexes.includes(index),
      );
      this.reindexBulkErrorsByRemovedIndexes(successOriginalIndexes);
      this.variantsCreated.emit();
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
    this.msg.add({
      severity: 'success',
      summary: `Se crearon ${successOriginalIndexes.length} variantes`,
    });

    if (this.bulkRows.length === 0) {
      this.addBulkRow();
    }
  }

  /**
   * Determina si una fila tiene al menos un atributo o precio cargado.
   * @param row - Fila del ingreso múltiple.
   */
  private isRowFilled(row: BulkRow): boolean {
    return (
      Boolean(row.color?.trim()) ||
      Boolean(row.size?.trim()) ||
      Boolean(row.capacity?.trim()) ||
      row.currentPrice !== null
    );
  }

  /**
   * Inicializa las filas por defecto del ingreso múltiple.
   */
  private resetBulkRows(): void {
    this.bulkRows = [
      {
        color: '',
        size: '',
        capacity: '',
        currentPrice: null,
        initialUnits: 1,
      },
      {
        color: '',
        size: '',
        capacity: '',
        currentPrice: null,
        initialUnits: 1,
      },
      {
        color: '',
        size: '',
        capacity: '',
        currentPrice: null,
        initialUnits: 1,
      },
    ];
    this.bulkRowErrors = {};
    this.bulkError = null;
  }

  /**
   * Valida en frontend cada fila cargada para evitar roundtrip innecesario.
   * @param rows - Filas normalizadas.
   * @returns Errores por fila/campo.
   */
  private buildLocalBulkErrors(
    rows: Array<{
      color?: string;
      size?: string;
      capacity?: string;
      currentPrice?: number;
      initialUnits?: number;
    }>,
  ): BulkRowErrors {
    const next: BulkRowErrors = {};
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

      if (
        initialUnits === undefined ||
        initialUnits === null ||
        !Number.isInteger(Number(initialUnits)) ||
        Number(initialUnits) < 0
      ) {
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
   * @param rawErrors - Estructura libre devuelta por la API.
   * @param {number[]} originalIndexMap - Mapa de índice-filtrado → índice-original en UI.
   */
  private mapBulkErrors(
    rawErrors: unknown,
    originalIndexMap: number[] = [],
  ): void {
    if (!Array.isArray(rawErrors)) return;

    for (const entry of rawErrors) {
      if (!entry || typeof entry !== 'object') continue;
      const filteredRow = Number((entry as { row?: unknown }).row);
      const field = String(
        (entry as { field?: unknown }).field || 'attributes',
      );
      const message = String(
        (entry as { message?: unknown }).message || 'Dato inválido.',
      );

      if (!Number.isInteger(filteredRow) || filteredRow < 0) continue;

      const row =
        originalIndexMap.length > 0
          ? (originalIndexMap[filteredRow] ?? filteredRow)
          : filteredRow;

      this.bulkRowErrors[row] = this.bulkRowErrors[row] || {};
      if (field === 'current_price') {
        this.bulkRowErrors[row].currentPrice = message;
      } else if (
        field === 'color' ||
        field === 'size' ||
        field === 'capacity'
      ) {
        this.bulkRowErrors[row][field as 'color' | 'size' | 'capacity'] =
          message;
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
    const next: BulkRowErrors = {};
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
    const next: BulkRowErrors = {};

    for (const [rawKey, value] of Object.entries(this.bulkRowErrors)) {
      const key = Number(rawKey);
      if (sorted.includes(key)) continue;
      const shift = sorted.filter((idx) => idx < key).length;
      next[key - shift] = value;
    }

    this.bulkRowErrors = next;
  }
}
