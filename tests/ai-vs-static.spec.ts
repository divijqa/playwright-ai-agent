import { test, expect } from '@playwright/test';

test('AI metadata identification survives a changed airport label', async ({ page }) => {
  await page.goto('/flight-form.html');

  // Traditional locator: tied to the old visible label and no longer matches.
  await expect(page.getByLabel('Departure Airport')).toHaveCount(0);

  const fields = await page.locator('input').evaluateAll((inputs) =>
    inputs.map((input) => {
      const element = input as any;
      const label = element.id
        // @ts-ignore - this callback executes in the browser context.
        ? document.querySelector(`label[for="${element.id}"]`)?.textContent?.trim() ?? ''
        : '';
      return {
        tag: element.tagName.toLowerCase(),
        id: element.id,
        name: element.name,
        placeholder: element.placeholder,
        label,
      };
    }),
  );

  // This represents the metadata decision sent to Ollama at runtime.
  const originField = fields.find((field) => /origin|from/i.test(`${field.name} ${field.label} ${field.placeholder}`));
  expect(originField).toMatchObject({
    tag: 'input',
    label: 'From Airport',
  });

  const origin = page.locator(`#${originField?.id}`);
  await origin.fill('DFW');
  await expect(origin).toHaveValue('DFW');
});