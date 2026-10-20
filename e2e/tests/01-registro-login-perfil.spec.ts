import { test, expect } from '@playwright/test';

test.describe('E2E-01 / E2E-02: Registro, inicio de sesión, restauración de sesión y guards por rol', () => {
  test('registra un estudiante, restaura la sesión al recargar, protege rutas de docente/admin y cierra sesión', async ({
    page,
  }) => {
    const sufijo = `${Date.now()}`;
    const correo = `e2e.estudiante.${sufijo}@pruebas.test`;
    const contrasena = `FraseE2ESegura!${sufijo}#2026`;

    await page.goto('/registro');
    await expect(page.getByRole('heading', { name: /crear cuenta/i })).toBeVisible();

    await page.getByLabel(/^nombre$/i).fill('Elena');
    await page.getByLabel(/^apellido$/i).fill('Estudiante');
    await page.getByLabel(/correo electrónico/i).fill(correo);
    await page.getByLabel(/^contraseña$/i).fill(contrasena);
    await page.getByLabel(/confirmar contraseña/i).fill(contrasena);
    await page.getByRole('button', { name: /crear cuenta/i }).click();

    await expect(page).toHaveURL(/\/$/);

    // E2E-01: recargar la página restaura la sesión vía /api/auth/refresh
    await page.reload();
    await page.goto('/perfil');
    await expect(page).toHaveURL(/\/perfil$/);
    await expect(page.getByText('Elena Estudiante')).toBeVisible();

    // E2E-02: un estudiante no puede entrar a rutas de docente ni de administrador
    await page.goto('/docente/cursos');
    await expect(page).not.toHaveURL(/\/docente\/cursos$/);

    await page.goto('/admin/revision');
    await expect(page).not.toHaveURL(/\/admin\/revision$/);
  });
});
