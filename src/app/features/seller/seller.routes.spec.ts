import { SELLER_ROUTES } from './seller.routes';
import { AppRoutes } from '../../shared/models/enums/routes.enum';

describe('SELLER_ROUTES', () => {
  it('usa el wizard compartido en operations/new', async () => {
    const route = SELLER_ROUTES.find((item) => item.path === AppRoutes.OPERATIONS_NEW);

    expect(route).toBeDefined();
    expect(route?.loadComponent).toBeDefined();

    const component = await route!.loadComponent!();

    expect(component).toBeDefined();
    expect((component as { name?: string }).name).toBe('NewOperationComponent');
  });
});
