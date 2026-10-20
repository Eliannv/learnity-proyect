import { test, expect } from '@playwright/test';

test.describe('E2E-03: Solicitudes de docente (estudiante → administrador)', () => {
  test('estudiante envía solicitud de docente con caracteres especiales sin ejecutar HTML', async ({
    page,
  }) => {
    const sufijo = `${Date.now()}`;
    const correo = `e2e.aspirante.${sufijo}@pruebas.test`;
    const contrasena = `FraseAspirante!${sufijo}#2026`;

    await page.goto('/registro');
    await page.getByLabel(/^nombre$/i).fill('Marco');
    await page.getByLabel(/^apellido$/i).fill('Aspirante');
    await page.getByLabel(/correo electrónico/i).fill(correo);
    await page.getByLabel(/^contraseña$/i).fill(contrasena);
    await page.getByLabel(/confirmar contraseña/i).fill(contrasena);
    await page.getByRole('button', { name: /crear cuenta/i }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/perfil');
    await page.getByLabel(/especialidad/i).fill('Arquitectura Web Segura <script>alert(1)</script>');
    await page
      .getByLabel(/motivación|experiencia/i)
      .fill(
        'Experiencia docente universitaria enseñando desarrollo web moderno, pruebas automatizadas y seguridad de aplicaciones.'
      );
    await page.getByRole('button', { name: /enviar solicitud/i }).click();

    await expect(page.getByText(/en revisión/i)).toBeVisible();
  });
});
