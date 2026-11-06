import { expect, test } from '@playwright/test';
import { MANAGER, newCustomer, signInApi, TECHNICIAN } from '../support/api.js';
import { approveRequest, requestService, scheduleVisit } from '../support/flows.js';
import { waitForEmail } from '../support/mailpit.js';

// Scheduling from the agenda screen runs in agenda.spec.ts; this file checks the confirmation email.
test.describe('RF-27 cadastrar serviço na agenda: email de confirmação ao cliente', { tag: '@RF-27' }, () => {
  test('o cliente recebe a confirmação da visita com o nome do técnico', async ({ request }, testInfo) => {
    const manager = await signInApi(request, MANAGER);
    const technician = await signInApi(request, TECHNICIAN);
    const customer = await newCustomer(request, testInfo, 'Vera Visita');
    const id = await requestService(request, customer, `Freezer com gelo (${crypto.randomUUID()}).`);
    await approveRequest(request, manager, id);
    await scheduleVisit(request, manager, id, technician);

    const email = await waitForEmail(request, customer.email, `Visita confirmada: solicitação nº ${id}`);
    expect(email.text).toContain(`Nosso técnico ${technician.name} vai até você`);
  });
});
