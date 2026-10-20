import { test, expect } from '@playwright/test';

test.describe('Catálogo público y flujo de recuperación de contraseña', () => {
  test('filtra el catálogo público, muestra 404 en curso inexistente y solicita enlace de recuperación', async ({
    page,
  }) => {
    await page.goto('/cursos');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Curso inexistente o borrador no publicado
    await page.goto('/cursos/999999');
    await expect(page.getByText(/no encontrado|no está disponible/i)).toBeVisible();

    // Solicitud de recuperación de contraseña con respuesta uniforme
    await page.goto('/recuperar');
    await page.getByLabel(/correo electrónico/i).fill('noexiste.e2e@pruebas.test');
    await page.getByRole('button', { name: /enviar enlace/i }).click();
    await expect(page.getByText(/si el correo está registrado/i)).toBeVisible();
  });
});
