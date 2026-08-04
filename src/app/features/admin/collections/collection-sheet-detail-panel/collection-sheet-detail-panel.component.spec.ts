import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { FormatService } from '../../../../core/services/format.service';
import { CollectionsService } from '../../../collector/collections.service';
import { CollectionSheetDetail } from '../../../collector/models/collection.model';
import { InstallmentsService } from '../../../seller/operations/installments.service';
import { CollectionPdfService } from '../collection-pdf.service';
import { CollectionSheetDetailPanelComponent } from './collection-sheet-detail-panel.component';

describe('CollectionSheetDetailPanelComponent', () => {
  let fixture: ComponentFixture<CollectionSheetDetailPanelComponent>;
  let component: CollectionSheetDetailPanelComponent;

  const detail: CollectionSheetDetail = {
    id: 'sheet-1',
    sheetDate: '2026-07-07',
    filterUsed: 'TODAY_AND_OVERDUE',
    status: 'ACTIVE',
    createdAt: '2026-07-07T00:00:00.000Z',
    sentAt: null,
    collectorId: 'collector-1',
    collectorName: 'Cobrador Demo',
    generatedByName: 'Admin Demo',
    totalItems: 2,
    items: [
      {
        orderNumber: 1,
        plannedAmount: 1000,
        inclusionCriteria: 'DUE_DATE',
        inclusionReason: 'DUE_TODAY',
        opPriority: 3,
        remainingAmount: 1000,
        antecedentId: null,
        antecedentType: null,
        antecedentDate: null,
        antecedentNotes: null,
        nextVisitDate: null,
        hasPendingPayment: false,
        installmentId: 'installment-1',
        installmentNumber: 1,
        dueDate: '2026-07-07',
        amountDue: 1000,
        amountPaid: 0,
        penaltyAmount: 0,
        installmentStatus: 'PENDING',
        creditId: 'credit-1',
        creditType: 'SALE',
        collectionReference: 'Cuota 1 de 3 - celular',
        customerName: 'Alejandro Ibanez',
        customerPhone: '3411111111',
        customerAddress: 'Corrientes 345',
        customerDni: '27678901',
        managementStatus: 'PENDING',
        additionalInstallmentsCount: 0,
        live: null,
      },
      {
        orderNumber: 2,
        plannedAmount: 2000,
        inclusionCriteria: 'DUE_DATE',
        inclusionReason: 'OVERDUE',
        opPriority: 2,
        remainingAmount: 2000,
        antecedentId: null,
        antecedentType: null,
        antecedentDate: null,
        antecedentNotes: null,
        nextVisitDate: null,
        hasPendingPayment: false,
        installmentId: 'installment-2',
        installmentNumber: 2,
        dueDate: '2026-07-07',
        amountDue: 2000,
        amountPaid: 0,
        penaltyAmount: 100,
        installmentStatus: 'OVERDUE',
        creditId: 'credit-2',
        creditType: 'LOAN',
        collectionReference: 'Cuota 2 de 4 - préstamo',
        customerName: 'Maria Gonzalez',
        customerPhone: '3412222222',
        customerAddress: 'Chacabuco 456',
        customerDni: '30111222',
        managementStatus: 'PENDING',
        additionalInstallmentsCount: 0,
        live: null,
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollectionSheetDetailPanelComponent],
      providers: [
        provideRouter([]),
        { provide: CollectionsService, useValue: { getById: () => of(detail) } },
        { provide: InstallmentsService, useValue: { getManagementLog: () => of([]) } },
        { provide: CollectionPdfService, useValue: { generate: () => undefined } },
        { provide: FormatService, useValue: { currency: (value: number) => `$ ${value}` } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionSheetDetailPanelComponent);
    component = fixture.componentInstance;
    component.sheetMeta = detail;
    component.selectedSheet = detail;
    fixture.detectChanges();
  });

  it('filtra cuotas por DNI del cliente', () => {
    component.searchTerm = '27678901';

    expect(component.filteredItems.length).toBe(1);
    expect(component.filteredItems[0].customerName).toBe('Alejandro Ibanez');
  });

  it('filtra cuotas por domicilio y limpia la búsqueda', () => {
    component.searchTerm = 'chacabuco';

    expect(component.filteredItems.length).toBe(1);
    expect(component.filteredItems[0].customerName).toBe('Maria Gonzalez');

    component.clearSearch();

    expect(component.searchTerm).toBe('');
    expect(component.filteredItems.length).toBe(2);
  });
});
