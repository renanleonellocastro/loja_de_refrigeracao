import { expect, test } from '@playwright/test';
import { expectAccessibleSettled } from '../support/a11y.js';
import { ADMIN, MANAGER, newCustomer, signInApi, TECHNICIAN } from '../support/api.js';
import { approveRequest, requestService, scheduleVisit } from '../support/flows.js';
import { waitForEmail } from '../support/mailpit.js';
import { signIn } from '../support/session.js';
import { closeToast } from '../support/toast.js';
import { open } from '../support/viewport.js';

// Following the state and answering the store run in service-requests.spec.ts; this file covers the cancellation.
test.describe('RF-32 meus agendamentos: o cliente cancela até a véspera', { tag: '@RF-32' }, () => {
  test('o cliente cancela a visita marcada e a loja e o técnico são avisados', async ({ page, request }, testInfo) => {
    const manager = await signInApi(request, MANAGER);
    const technician = await signInApi(request, TECHNICIAN);
    const customer = await newCustomer(request, testInfo, 'Clara Cancela');
    const id = await requestService(request, customer, `Lavadora vazando (${crypto.randomUUID()}).`);
    await approveRequest(request, manager, id);
    await scheduleVisit(request, manager, id, technician);
    const reason = `Consegui resolver sozinha (${testInfo.project.name}).`;

    await signIn(page, customer.email);
    await open(page, `/minha-conta/agendamentos/${id}`);
    await page.getByRole('button', { name: 'Cancelar agendamento' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cancelar este agendamento?' });
    await dialog.getByLabel('Motivo (opcional)').fill(reason);
    await expectAccessibleSettled(page);
    await dialog.getByRole('button', { name: 'Cancelar agendamento' }).click();
    await closeToast(page, 'Agendamento cancelado.');
    await expect(page.getByText(reason).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar agendamento' })).toHaveCount(0);

    const notice = await waitForEmail(request, ADMIN, `Solicitação nº ${id} cancelada pelo cliente`);
    expect(notice.text).toContain(reason);
    await waitForEmail(request, TECHNICIAN, `Visita cancelada: solicitação nº ${id}`);
  });
});
