import { test, expect } from '@playwright/test';
import { crearCuenta } from '../soporte/bd';
import { correoNuevo, iniciarSesionPorUI, otroContexto, registrarPorUI, xssEjecutado } from '../soporte/ui';

const ESPECIALIDAD_XSS = '<img src=x onerror="window.__xss=1"> Redes';
const MOTIVO_XSS =
  'Experiencia docente enseñando redes y seguridad. <script>window.__xss=2</script> <b>negrita</b> para comprobar que el HTML no se interpreta.';

test.describe('E2E-03: solicitud de rol docente (estudiante → administrador)', () => {
  test('el texto con HTML se ve literal para el estudiante y para el admin, y la aprobación da el rol', async ({ page, context }) => {
    const dialogos: string[] = [];
    page.on('dialog', async (d) => {
      dialogos.push(d.message());
      await d.dismiss();
    });

    // 1. El estudiante se registra y envía la solicitud.
    await registrarPorUI(page, correoNuevo('aspirante'), 'Aspirante');
    await page.goto('/perfil');
    await page.getByRole('button', { name: /Solicitar ser docente/ }).click();
    await page.getByLabel('Especialidad o tema').fill(ESPECIALIDAD_XSS);
    await page.getByLabel('¿Por qué quieres enseñar?').fill(MOTIVO_XSS);
    await page.getByRole('button', { name: /Enviar solicitud/ }).click();
    await expect(page.getByText('Solicitud enviada.')).toBeVisible();
    await page.getByRole('button', { name: 'Entendido' }).click();

    // Se ve como texto: ni imagen inyectada ni script ejecutado.
    await expect(page.getByText('En revisión')).toBeVisible();
    await expect(page.getByText(ESPECIALIDAD_XSS)).toBeVisible();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await xssEjecutado(page)).toBe(false);

    // 2. El administrador la ve igual de literal y la aprueba.
    const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin');
    const { contexto, pagina } = await otroContexto(context);
    try {
      pagina.on('dialog', async (d) => {
        dialogos.push(d.message());
        await d.dismiss();
      });
      await iniciarSesionPorUI(pagina, admin.correo);
      await pagina.goto('/admin/solicitudes');
      await pagina.getByRole('button', { name: /Aspirante/ }).first().click();
      await expect(pagina.locator('strong', { hasText: ESPECIALIDAD_XSS })).toBeVisible();
      await expect(pagina.getByText('<script>window.__xss=2</script>', { exact: false })).toBeVisible();
      await expect(pagina.locator('img[src="x"]')).toHaveCount(0);
      expect(await xssEjecutado(pagina)).toBe(false);

      await pagina.getByRole('button', { name: /Aprobar y asignar rol Docente/ }).click();
      await expect(pagina.getByText(/ya es docente/)).toBeVisible();
    } finally {
      await contexto.close();
    }

    // 3. El estudiante recarga: el rol nuevo aplica sin volver a entrar y /perfil pasa a sus ajustes de docente.
    await page.goto('/perfil');
    await expect(page).toHaveURL(/\/docente\/perfil$/);
    await page.goto('/docente/cursos');
    await expect(page.getByRole('heading', { name: 'Mis cursos' })).toBeVisible();
    expect(dialogos, 'ningún alert/confirm/prompt de la página').toEqual([]);
  });
});
