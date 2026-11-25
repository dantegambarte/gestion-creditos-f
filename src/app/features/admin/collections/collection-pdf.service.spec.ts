import { TestBed } from '@angular/core/testing';
import { CollectionPdfService } from './collection-pdf.service';

describe('CollectionPdfService.mapDetailToResult', () => {
  it('el total del encabezado coincide con la suma de filas en cuotas parciales', () => {
    const svc = TestBed.inject(CollectionPdfService);
    const item = (amountDue: number, remaining: number | null): any => ({
      customerName: 'C',
      customerPhone: null,
      customerAddress: null,
      creditId: 'cr',
      creditType: 'SALE',
      installmentNumber: 1,
      amountDue,
      amountPaid: amountDue - (remaining ?? amountDue),
      remainingAmount: remaining,
      dueDate: '2026-11-25',
      installmentStatus: 'PENDING',
      collectionReference: '',
      additionalInstallmentsCount: 0,
    });
    const result = svc.mapDetailToResult({
      id: 's1',
      collectorId: 'c1',
      collectorName: 'Luis',
      sheetDate: '2026-11-25',
      items: [item(1000, 400), item(500, null)],
    } as any);
    const rowsSum = result.entries.reduce((s, e) => s + e.amount, 0);
    expect(rowsSum).toBe(900);
    expect(result.totalAmount).toBe(rowsSum);
  });
});
