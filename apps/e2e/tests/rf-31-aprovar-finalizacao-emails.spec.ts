import { expect, test } from '@playwright/test';
import { MANAGER, newCustomer, signInApi, TECHNICIAN } from '../support/api.js';
import { approveFinalization, approveRequest, finalizeVisit, requestService, scheduleVisit } from '../support/flows.js';
import { waitForEmail } from '../support/mailpit.js';

// The approval screen runs in agenda.spec.ts; this file checks the summary email to the customer.
test.describe('RF-31 aprovar finalização: email ao cliente com o resumo', { tag: '@RF-31' }, () => {
  test('o cliente recebe o resumo do serviço com o valor aprovado', async ({ request }, testInfo) => {
    const manager = await signInApi(request, MANAGER);
    const technician = await signInApi(request, TECHNICIAN);
    const customer = await newCustomer(request, testInfo, 'Olga Aprovada');
    const id = await requestService(request, customer, `Geladeira sem luz interna (${crypto.randomUUID()}).`);
    await approveRequest(request, manager, id);
    const visit = await scheduleVisit(request, manager, id, technician);
    const repair = `Troca do interruptor da porta (${crypto.randomUUID()}).`;
    await finalizeVisit(request, technician, visit, repair);
    await approveFinalization(request, manager, visit, 18_000);

    const email = await waitForEmail(request, customer.email, `Serviço concluído: solicitação nº ${id}`);
    expect(email.text).toContain(repair);
    expect(email.text).toMatch(/R\$\s180,00/);
  });
});
