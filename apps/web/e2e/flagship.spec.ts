import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('flagship evidence flow', () => {
  test('uploads, processes, opens, and cites a contract', async ({ page }) => {
    await page.goto('/library');
    await expect(page.getByRole('heading', { name: 'Customer contracts' })).toBeVisible();

    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Add documents' })).toBeVisible();
    await page.getByLabel('Choose documents to upload').setInputFiles({
      name: 'Acme-MSA-v4.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\nVeyra acceptance fixture'),
    });
    await expect(page.getByText('Security scan', { exact: true })).toBeVisible();
    await expect(page.getByText('The document is ready in Customer contracts.')).toBeVisible({
      timeout: 8_000,
    });
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText(/trusted, indexed, and ready to search/)).toBeVisible();

    await page.getByRole('link', { name: 'Acme Master Services Agreement' }).first().click();
    await expect(
      page.getByRole('heading', { name: 'Acme Master Services Agreement' }),
    ).toBeVisible();
    await expect(page.getByText('99.95% monthly uptime.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Open citation on page 8' }).click();
    await expect(page.locator('#evidence-clause')).toContainText('99.95% monthly uptime');
  });

  test('search preview keeps authorization and provenance visible', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
    const firstResult = page
      .getByRole('button', { name: /Acme Master Services Agreement/ })
      .first();
    if (test.info().project.name === 'mobile') {
      await firstResult.click();
    }
    const preview = page.getByRole('complementary', { name: 'Search result preview' });
    await expect(preview.getByText('You have access through Legal workspace')).toBeVisible();
    await expect(preview.getByRole('heading', { name: '7.2 Service availability' })).toBeVisible();
    await expect(preview.getByText(/99.95% monthly uptime/).first()).toBeVisible();
  });

  test('streams a follow-up answer and exposes exact evidence', async ({ page }) => {
    await page.goto('/ask');
    await expect(page.getByText('The current commitment is', { exact: false })).toBeVisible();
    await page.getByLabel('Ask a follow-up').fill('Confirm the current Acme uptime commitment.');
    await page.getByRole('button', { name: 'Send question' }).click();
    await expect(
      page
        .getByText(/Applying permissions|Applied permissions|Finding authorized evidence/)
        .first(),
    ).toBeVisible();
    await expect(page.getByText(/The current commitment is 99.95% monthly uptime/)).toBeVisible({
      timeout: 8_000,
    });
    if (test.info().project.name === 'mobile') {
      await page.getByRole('button', { name: 'View evidence' }).click();
    }
    await expect(page.getByText('Authorized through Legal workspace')).toBeVisible();
  });

  test('command palette is keyboard accessible', async ({ page }) => {
    await page.goto('/library');
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Search commands').fill('Ask');
    await page.getByRole('button', { name: 'Ask Veyra' }).click();
    await expect(page).toHaveURL(/\/ask$/);
  });

  test('library has no serious accessibility violations', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile',
      'Desktop table accessibility is audited separately.',
    );
    await page.goto('/library');
    await expect(page.getByRole('heading', { name: 'Customer contracts' })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
