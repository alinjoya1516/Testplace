import { type Page, expect, test } from '@playwright/test';
import { resetDatabase, sampleFiles, zipArchive } from '../support';

test.beforeEach(async () => {
  await resetDatabase();
});

async function importArchive(page: Page, archive: ReturnType<typeof zipArchive>): Promise<void> {
  await page.goto('/imports');
  await page.locator('input[type="file"]').setInputFiles(archive);
  await page.getByRole('button', { name: 'Importer' }).click();
}

test('importing the sample set, browsing the cases, then re-importing creates no version (criterion 1)', async ({
  page,
}) => {
  await importArchive(page, zipArchive('samples.zip', sampleFiles()));
  await expect(page.getByRole('heading', { name: 'Révision n° 1 : Appliqué' })).toBeVisible();
  await expect(page.locator('p', { hasText: 'Créés :' })).toContainText(
    'TC-CRT-01, TC-CRT-02, TC-LOG-01.1, TC-LOG-01.2, TC-LOG-01.3, TC-LOG-02, TC-LOG-03, TC-PRF-01, TC-PRF-02',
  );

  await page.getByRole('link', { name: 'Cas', exact: true }).click();
  await expect(page.getByText('9 cas')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(9);

  await page.getByLabel('Rechercher (identifiant, titre, étapes)').fill('display name');
  await expect(page.getByText('1 cas')).toBeVisible();
  await expect(page).toHaveURL(/q=display/);

  await page.getByRole('link', { name: 'TC-PRF-01' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'A new display name is kept after logging in again',
  );
  await expect(page.getByText('account/user-profile.feature')).toBeVisible();
  const steps = page.locator('table').first().locator('tbody tr');
  await expect(steps).toHaveCount(2);
  await expect(steps.nth(1)).toContainText('I log out and log in again');
  await expect(steps.nth(1)).toContainText('the new display name is shown on the profile page');

  await importArchive(page, zipArchive('samples.zip', sampleFiles()));
  await expect(page.getByRole('heading', { name: 'Révision n° 2 : Appliqué' })).toBeVisible();
  await expect(page.locator('.counts')).toContainText('Créés0');
  await expect(page.locator('.counts')).toContainText('Modifiés0');
  await expect(page.locator('.counts')).toContainText('Inchangés9');

  await page.goto('/cases/TC-PRF-01');
  await expect(page.locator('table.versions tbody tr')).toHaveCount(1);
});

test('the case list filters by status and tags, and keeps the filters in the URL', async ({ page }) => {
  await importArchive(page, zipArchive('samples.zip', sampleFiles()));
  await expect(page.getByRole('heading', { name: 'Révision n° 1 : Appliqué' })).toBeVisible();
  await page.goto('/cases');
  await expect(page.getByText('9 cas')).toBeVisible();

  await page.getByRole('combobox', { name: 'Statut' }).click();
  await page.getByRole('option', { name: 'Draft', exact: true }).click();
  await expect(page.getByText('1 cas')).toBeVisible();
  await expect(page.getByRole('link', { name: 'TC-LOG-03' })).toBeVisible();

  await page.getByRole('button', { name: 'Effacer les filtres' }).click();
  await expect(page.getByText('9 cas')).toBeVisible();

  await page.getByRole('combobox', { name: 'Tags' }).click();
  await page.getByRole('option', { name: '@critical' }).click();
  await page.getByRole('option', { name: '@smoke' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('3 cas')).toBeVisible();
  await expect(page).toHaveURL(/tag=@critical&tag=@smoke/);

  await page.reload();
  await expect(page.getByText('3 cas')).toBeVisible();
});

test('a rejected import shows each error with its file and line, and changes nothing (criterion 2)', async ({
  page,
}) => {
  const invalid = {
    ...sampleFiles(),
    'other/invalid.feature': [
      'Feature: Invalid',
      '',
      '  @TC-PRF-01',
      '  Scenario: Duplicate identifier',
      '    When I act',
      '',
      '  @smoke',
      '  Scenario: Missing identifier',
      '    When I act',
      '',
    ].join('\n'),
  };
  await importArchive(page, zipArchive('invalid.zip', invalid));

  await expect(page.getByRole('heading', { name: 'Révision n° 1 : Rejeté' })).toBeVisible();
  const errors = page.locator('section').first().locator('tbody tr');
  await expect(errors).toHaveCount(2);
  await expect(errors.nth(0)).toContainText('other/invalid.feature');
  await expect(errors.nth(0)).toContainText('8');
  await expect(errors.nth(0)).toContainText('sans identifiant');
  await expect(errors.nth(1)).toContainText(
    'Identifiant TC-PRF-01 déjà utilisé (account/user-profile.feature, ligne 5).',
  );

  await page.getByRole('link', { name: 'Cas', exact: true }).click();
  await expect(page.getByText('0 cas')).toBeVisible();
});
