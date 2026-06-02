import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { HolidaysConfigComponent } from './holidays-config.component';
import { HolidaysService } from '../services/holidays.service';

describe('HolidaysConfigComponent', () => {
  let component: HolidaysConfigComponent;
  let fixture: ComponentFixture<HolidaysConfigComponent>;
  let holidaysService: jasmine.SpyObj<HolidaysService>;
  let messageService: MessageService;

  const holidayRows = [
    {
      id: 'h-older',
      date: '2026-01-01',
      name: 'Año nuevo',
      type: 'NATIONAL' as const,
      affectsDueDates: true,
      active: true,
      repeatsAnnually: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'h-newer',
      date: '2026-12-25',
      name: 'Navidad',
      type: 'NATIONAL' as const,
      affectsDueDates: true,
      active: true,
      repeatsAnnually: true,
      createdAt: '',
      updatedAt: '',
    },
  ];

  beforeEach(async () => {
    holidaysService = jasmine.createSpyObj<HolidaysService>('HolidaysService', [
      'getAll',
      'create',
      'update',
      'previewDuplicateToNextYear',
      'duplicateToNextYear',
    ]);
    holidaysService.getAll.and.returnValue(of(holidayRows));
    holidaysService.previewDuplicateToNextYear.and.returnValue(
      of({
        sourceYear: 2026,
        targetYear: 2027,
        eligibleCount: 2,
        toCreateCount: 1,
        skippedCount: 1,
        conflictsCount: 0,
        invalidDatesCount: 0,
        nonRecurringCount: 1,
        toCreate: [
          {
            sourceDate: '2026-01-01',
            targetDate: '2027-01-01',
            type: 'NATIONAL',
            name: 'Año nuevo',
          },
        ],
        skipped: [
          {
            sourceDate: '2026-05-01',
            targetDate: null,
            type: 'EXTRAORDINARY',
            name: 'Puente',
            reason: 'not_recurring_annual',
          },
        ],
      }),
    );
    holidaysService.duplicateToNextYear.and.returnValue(
      of({
        sourceYear: 2026,
        targetYear: 2027,
        createdCount: 1,
        skippedCount: 0,
        conflictsCount: 0,
        created: [],
        skipped: [],
      }),
    );

    await TestBed.configureTestingModule({
      imports: [HolidaysConfigComponent, NoopAnimationsModule],
      providers: [{ provide: HolidaysService, useValue: holidaysService }],
    }).compileComponents();

    fixture = TestBed.createComponent(HolidaysConfigComponent);
    component = fixture.componentInstance;
    messageService = fixture.debugElement.injector.get(MessageService);
    spyOn(messageService, 'add');
    fixture.detectChanges();
  });

  it('carga y ordena feriados por fecha descendente al iniciar', () => {
    expect(holidaysService.getAll).toHaveBeenCalled();
    expect(component.holidays.map((item) => item.id)).toEqual(['h-newer', 'h-older']);
    expect(component.loading).toBeFalse();
  });

  it('abre el diálogo de edición con el feriado seleccionado como editingHoliday', () => {
    component.openEditDialog(holidayRows[0]);

    expect(component.showFormDialog).toBeTrue();
    expect(component.editingHoliday).toBe(holidayRows[0]);
  });

  it('abre el diálogo de creación con editingHoliday en null', () => {
    component.editingHoliday = holidayRows[0];
    component.openCreateDialog();

    expect(component.showFormDialog).toBeTrue();
    expect(component.editingHoliday).toBeNull();
  });

  it('previewDuplicateToNextYear advierte si el año es inválido', () => {
    component.duplicateSourceYear = 1999;

    component.previewDuplicateToNextYear();

    expect(holidaysService.previewDuplicateToNextYear).not.toHaveBeenCalled();
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'warn', summary: 'Año inválido' }),
    );
  });

  it('previewDuplicateToNextYear abre el diálogo con la vista previa', () => {
    component.duplicateSourceYear = 2026;

    component.previewDuplicateToNextYear();

    expect(holidaysService.previewDuplicateToNextYear).toHaveBeenCalledWith({ sourceYear: 2026 });
    expect(component.showDuplicatePreviewDialog).toBeTrue();
    expect(component.duplicatePreview?.toCreateCount).toBe(1);
  });

  it('onHolidayCreated agrega el feriado a la lista y muestra toast de éxito', () => {
    const newHoliday = { ...holidayRows[0], id: 'h-new', date: '2026-07-09' };
    const prevCount = component.holidays.length;

    component.onHolidayCreated({ holiday: newHoliday, recalculatedInstallments: 0 });

    expect(component.holidays.length).toBe(prevCount + 1);
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'success', summary: 'Feriado creado' }),
    );
  });

  it('onHolidayUpdated reemplaza el feriado en la lista y muestra toast de éxito', () => {
    const updated = { ...holidayRows[1], name: 'Navidad actualizada' };

    component.onHolidayUpdated(updated);

    expect(component.holidays.find((h) => h.id === 'h-newer')?.name).toBe('Navidad actualizada');
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'success', summary: 'Feriado actualizado' }),
    );
  });

  it('onDuplicated recarga la lista de feriados', () => {
    const callsBefore = holidaysService.getAll.calls.count();

    component.onDuplicated();

    expect(holidaysService.getAll.calls.count()).toBe(callsBefore + 1);
  });
});
