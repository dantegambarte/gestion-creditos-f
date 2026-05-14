import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
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
    holidaysService.create.and.returnValue(
      of({ holiday: holidayRows[0], recalculatedInstallments: 0 }),
    );
    holidaysService.update.and.returnValue(of(holidayRows[0]));
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

  it('resetea flags al elegir extraordinario y reactiva anual repetible en tipos no extraordinarios', () => {
    component.createForm.repeatsAnnually = true;
    component.createForm.recalculateFutureInstallments = true;
    component.createForm.type = 'EXTRAORDINARY';

    component.onTypeChanged(component.createForm);

    expect(component.createForm.repeatsAnnually).toBeFalse();
    expect(component.createForm.recalculateFutureInstallments).toBeFalse();

    component.createForm.type = 'NATIONAL';
    component.onTypeChanged(component.createForm);

    expect(component.createForm.repeatsAnnually).toBeTrue();
  });

  it('abre edición parseando la fecha API a Date', () => {
    component.openEditDialog(holidayRows[0]);

    expect(component.showEditDialog).toBeTrue();
    expect(component.editForm.date instanceof Date).toBeTrue();
    expect(component.editForm.date?.getFullYear()).toBe(2026);
  });

  it('submitCreate serializa fecha y fuerza repeatsAnnually false para extraordinarios', () => {
    component.openCreateDialog();
    component.createForm.date = new Date(2026, 4, 1);
    component.createForm.name = ' Puente '; 
    component.createForm.type = 'EXTRAORDINARY';
    component.createForm.affectsDueDates = true;
    component.createForm.active = true;
    component.createForm.repeatsAnnually = true;
    component.createForm.recalculateFutureInstallments = true;
    holidaysService.create.and.returnValue(
      of({
        holiday: {
          ...holidayRows[0],
          id: 'h-created',
          date: '2026-05-01',
          name: 'Puente',
          type: 'EXTRAORDINARY',
          repeatsAnnually: false,
        },
        recalculatedInstallments: 2,
      }),
    );

    component.submitCreate();

    expect(holidaysService.create).toHaveBeenCalledWith({
      date: '2026-05-01',
      name: 'Puente',
      type: 'EXTRAORDINARY',
      affectsDueDates: true,
      active: true,
      repeatsAnnually: false,
      recalculateFutureInstallments: true,
    });
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({
        severity: 'success',
        summary: 'Feriado creado',
      }),
    );
    expect(component.showCreateDialog).toBeFalse();
  });

  it('submitCreate muestra error cuando backend falla', () => {
    component.openCreateDialog();
    component.createForm.date = new Date(2026, 4, 1);
    component.createForm.name = 'Puente';
    holidaysService.create.and.returnValue(
      throwError(() => ({ message: 'Ya existe el feriado.' })),
    );

    component.submitCreate();

    expect(component.errorMessage).toBe('Ya existe el feriado.');
    expect(component.saving).toBeFalse();
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

  it('confirmDuplicateToNextYear ejecuta duplicación, cierra preview y recarga listado', () => {
    component.duplicatePreview = {
      sourceYear: 2026,
      targetYear: 2027,
      eligibleCount: 2,
      toCreateCount: 1,
      skippedCount: 0,
      conflictsCount: 0,
      invalidDatesCount: 0,
      nonRecurringCount: 0,
      toCreate: [],
      skipped: [],
    };
    component.showDuplicatePreviewDialog = true;

    component.confirmDuplicateToNextYear();

    expect(holidaysService.duplicateToNextYear).toHaveBeenCalledWith({ sourceYear: 2026 });
    expect(component.showDuplicatePreviewDialog).toBeFalse();
    expect(holidaysService.getAll).toHaveBeenCalledTimes(2);
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'success', summary: 'Duplicación completada' }),
    );
  });

  it('muestra toast de error si falla la duplicación', () => {
    component.duplicatePreview = {
      sourceYear: 2026,
      targetYear: 2027,
      eligibleCount: 2,
      toCreateCount: 1,
      skippedCount: 0,
      conflictsCount: 0,
      invalidDatesCount: 0,
      nonRecurringCount: 0,
      toCreate: [],
      skipped: [],
    };
    holidaysService.duplicateToNextYear.and.returnValue(
      throwError(() => ({ message: 'No se pudo duplicar.' })),
    );

    component.confirmDuplicateToNextYear();

    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'error', summary: 'Error al duplicar' }),
    );
    expect(component.duplicating).toBeFalse();
  });

  it('configura ambos calendarios con showOnFocus=false para evitar auto apertura del overlay', () => {
    component.showCreateDialog = true;
    component.showEditDialog = true;
    fixture.detectChanges();

    const calendars = fixture.debugElement.queryAll(By.css('p-calendar'));

    expect(calendars.length).toBe(2);
    calendars.forEach((calendar) => {
      expect(calendar.nativeElement.getAttribute('ng-reflect-show-on-focus')).toBe('false');
    });
  });
});
