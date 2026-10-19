import { expect, test } from '@playwright/test';
import { resetDatabase, sampleFiles, zipArchive } from '../support';

test.beforeEach(async ({ page }) => {
  await resetDatabase();
  await page.goto('/imports');
  await page.locator('input[type="file"]').setInputFiles(zipArchive('samples.zip', sampleFiles()));
  await page.getByRole('button', { name: 'Importer' }).click();
  await expect(page.getByRole('heading', { name: 'Révision n° 1 : Appliqué' })).toBeVisible();
});

test('a campaign is created with a live preview, launched, assigned and closed', async ({ page }) => {
  await page.getByRole('link', { name: 'Campagnes' }).click();
  await page.getByRole('link', { name: 'Nouvelle campagne' }).click();

  // The expression starts with the default exclusion of quarantined cases:
  // 8 Ready cases (TC-LOG-03 is Draft), minus TC-LOG-02 in quarantine.
  const expression = page.getByLabel('Expression de tags');
  await expect(expression).toHaveValue('not @quarantine');
  await expect(page.getByText('7 cas sélectionnés')).toBeVisible();

  await page.getByLabel('Nom').fill('Release 2.4 regression');
  await page.getByLabel('Build ou version').fill('2.4.0-rc1');
  await page.getByLabel('Environnement').fill('Recette');
  await expression.fill('@critical and not @quarantine');
  await expect(page.getByText('5 cas sélectionnés')).toBeVisible();
  await expression.fill('critical');
  await expect(page.getByText('« critical » doit commencer par @')).toBeVisible();
  await expression.fill('@critical and not @quarantine');
  await page.getByRole('button', { name: 'Créer la campagne' }).click();

  await expect(page.getByRole('heading', { name: 'Release 2.4 regression' })).toBeVisible();
  await expect(page.getByText('En préparation')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cas sélectionnés (5)' })).toBeVisible();

  await page.getByRole('button', { name: 'Lancer la campagne' }).click();
  await expect(page.getByText('En cours')).toBeVisible();
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(5);

  await page.getByRole('checkbox', { name: 'Sélectionner TC-CRT-01' }).check();
  await page.getByRole('checkbox', { name: 'Sélectionner TC-PRF-01' }).check();
  await page.getByRole('combobox', { name: 'Affecter la sélection à' }).click();
  await page.getByRole('option', { name: 'Exécutant A' }).click();
  await page.getByRole('button', { name: 'Affecter 2 cas' }).click();
  await expect(rows.filter({ hasText: 'Exécutant A' })).toHaveCount(2);

  await page.getByRole('button', { name: 'Clôturer' }).click();
  await expect(page.getByText('5 cas ne sont pas exécutés')).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Clôturer' }).click();
  await expect(page.getByText('Clôturée', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: '← Campagnes' }).click();
  await expect(page.locator('tbody tr').first()).toContainText('Release 2.4 regression');
  await expect(page.locator('tbody tr').first()).toContainText('Clôturée');
});

test('a campaign is duplicated for another build', async ({ page }) => {
  await page.goto('/campaigns/new');
  await page.getByLabel('Nom').fill('Smoke');
  await page.getByLabel('Build ou version').fill('1.0');
  await page.getByLabel('Environnement').fill('Recette');
  await page.getByRole('button', { name: 'Créer la campagne' }).click();
  await expect(page.getByRole('heading', { name: 'Smoke' })).toBeVisible();

  await page.getByRole('button', { name: 'Dupliquer' }).click();
  await page.getByLabel('Nouveau build').fill('1.1');
  await page.getByRole('button', { name: 'Créer la copie' }).click();
  await expect(page.getByRole('heading', { name: 'Smoke (copie)' })).toBeVisible();
  await expect(page.getByText('1.1', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'campagne n° 1' })).toBeVisible();
});
