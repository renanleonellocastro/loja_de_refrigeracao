import { expect, test } from '@playwright/test';
import { ADMIN, MANAGER, newCustomer, signInApi, TECHNICIAN } from '../support/api.js';
import { approveRequest, finalizeVisit, requestService, scheduleVisit } from '../support/flows.js';
import { waitForEmail } from '../support/mailpit.js';

// The technician finalizes on a phone in agenda.spec.ts; this file checks the email to the management.
test.describe('RF-30 finalizar serviço: email à gerência', { tag: '@RF-30' }, () => {
  test('a finalização do técnico chega por email aos gerentes e ao super usuário', async ({ request }, testInfo) => {
    const manager = await signInApi(request, MANAGER);
    const technician = await signInApi(request, TECHNICIAN);
    const customer = await newCustomer(request, testInfo, 'Fábio Final');
    const id = await requestService(request, customer, `Geladeira fazendo barulho (${crypto.randomUUID()}).`);
    await approveRequest(request, manager, id);
    const visit = await scheduleVisit(request, manager, id, technician);
    const repair = `Troca do ventilador do evaporador (${crypto.randomUUID()}).`;
    await finalizeVisit(request, technician, visit, repair);

    for (const staff of [MANAGER, ADMIN]) {
      const email = await waitForEmail(request, staff, `Serviço finalizado: solicitação nº ${id}`);
      expect(email.text).toContain(repair);
    }
  });
});
