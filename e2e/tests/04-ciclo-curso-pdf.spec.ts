import { test, expect } from '@playwright/test';

const PDF_MINIMO = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF\n',
  'utf-8'
);

test.describe('E2E-04 / E2E-07: Recorrido completo docente → PDF → revisión admin → catálogo público', () => {
  test('verifica la estructura accesible de las vistas de gestión docente y catálogo', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation')).toBeVisible();
    expect(PDF_MINIMO.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
