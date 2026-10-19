// Ayuda para los casos "Capturar" del PLAN_PRUEBAS: imprime el comportamiento observado una vez
// (línea "CAPTURA <id> <json>") para fijarlo después como aserción. No afirma nada por sí misma.
export function capturar(id: string, valor: unknown): void {
  console.log(`CAPTURA ${id} ${JSON.stringify(valor)}`);
}
