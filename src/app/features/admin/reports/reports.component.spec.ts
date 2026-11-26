import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { HeaderService } from '../../../core/services/header.service';
import { ReportsComponent } from './reports.component';

describe('ReportsComponent', () => {
  let fixture: ComponentFixture<ReportsComponent>;
  let component: ReportsComponent;
  let header: jasmine.SpyObj<HeaderService>;
  let router: jasmine.SpyObj<Router>;

  /**
   * Crea el componente con los query params dados, sin renderizar las pestañas hijas.
   * @param params - query params simulados de la ruta
   */
  async function create(params: Record<string, string> = {}): Promise<void> {
    header = jasmine.createSpyObj('HeaderService', ['set', 'reset']);
    router = jasmine.createSpyObj('Router', ['navigateByUrl']);
    await TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [
        { provide: HeaderService, useValue: header },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } },
      ],
    })
      .overrideComponent(ReportsComponent, { set: { template: '', imports: [] } })
      .compileComponents();
    fixture = TestBed.createComponent(ReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('arranca en el resumen del día y fija el header', async () => {
    await create();
    expect(component.activeTab).toBe('summary');
    expect(header.set).toHaveBeenCalledOnceWith([{ label: 'Reportes' }]);
  });

  it('abre la pestaña indicada por el query param tab cuando es válida', async () => {
    await create({ tab: 'overdue' });
    expect(component.activeTab).toBe('overdue');
  });

  it('ignora un query param tab desconocido', async () => {
    await create({ tab: 'hackeado' });
    expect(component.activeTab).toBe('summary');
  });

  it('vuelve a la pantalla origen indicada por returnTo', async () => {
    await create({ returnTo: '/admin/clients/123' });
    component.goBackToOrigin();
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/admin/clients/123');
  });

  it('no navega al volver si no hay returnTo', async () => {
    await create();
    component.goBackToOrigin();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('cambia de pestaña con el evento global report-tab-change', async () => {
    await create();
    document.dispatchEvent(new CustomEvent('report-tab-change', { detail: 'collectors' }));
    expect(component.activeTab).toBe('collectors');
  });

  it('deja de escuchar el evento y resetea el header al destruirse', async () => {
    await create();
    fixture.destroy();
    document.dispatchEvent(new CustomEvent('report-tab-change', { detail: 'collectors' }));
    expect(component.activeTab).toBe('summary');
    expect(header.reset).toHaveBeenCalled();
  });
});
