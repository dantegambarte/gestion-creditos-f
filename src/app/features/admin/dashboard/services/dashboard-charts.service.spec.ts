import { TestBed } from '@angular/core/testing';
import { DashboardChartsService } from './dashboard-charts.service';

interface BarData {
  labels: string[];
  datasets: { data: number[] }[];
}

describe('DashboardChartsService.buildWeeklyChart (#62)', () => {
  let svc: DashboardChartsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(DashboardChartsService);
  });

  it('un domingo muestra los 7 días, domingo incluido', () => {
    const sunday = new Date(2026, 10, 29); // domingo 29/11/2026
    const data = svc.buildWeeklyChart([{ day: '2026-11-29', total: 700 }], sunday).data as BarData;
    expect(data.labels).toEqual(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);
    expect(data.datasets[0].data[6]).toBe(700);
  });

  it('un miércoles muestra lunes a miércoles', () => {
    const wednesday = new Date(2026, 10, 25);
    const data = svc.buildWeeklyChart([], wednesday).data as BarData;
    expect(data.labels).toEqual(['Lun', 'Mar', 'Mié']);
  });

  it('el mismo día de la semana de otra semana no pisa al de la semana actual', () => {
    const wednesday = new Date(2026, 10, 25);
    const data = svc.buildWeeklyChart(
      [
        { day: '2026-11-23', total: 100 }, // lunes de esta semana
        { day: '2026-11-30', total: 999 }, // lunes de la semana siguiente (no debe pisar)
        { day: '2026-11-16', total: 555 }, // lunes de la semana anterior
      ],
      wednesday,
    ).data as BarData;
    expect(data.datasets[0].data).toEqual([100, 0, 0]);
  });
});
