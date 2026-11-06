import { expect, test } from '@playwright/test';
import { ADMIN, MANAGER, newCustomer } from '../support/api.js';
import { FRIDGE_REPAIR, requestService } from '../support/flows.js';
import { waitForEmail } from '../support/mailpit.js';

// The request form runs in service-requests.spec.ts; this file checks the emails it sends.
test.describe('RF-25 solicitar agendamento: emails ao cliente e à gerência', { tag: '@RF-25' }, () => {
  test('a solicitação chega por email ao cliente, aos gerentes e ao super usuário', async ({ request }, testInfo) => {
    const customer = await newCustomer(request, testInfo, 'Sara Solicita');
    const problem = `Geladeira não gela (${crypto.randomUUID()}).`;
    const id = await requestService(request, customer, problem);

    await waitForEmail(request, customer.email, `Recebemos sua solicitação nº ${id}`);
    for (const staff of [MANAGER, ADMIN]) {
      const notice = await waitForEmail(request, staff, `Nova solicitação nº ${id}: ${FRIDGE_REPAIR}`);
      expect(notice.text).toContain(problem);
    }
  });
});
