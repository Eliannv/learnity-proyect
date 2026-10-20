<#
.SYNOPSIS
  Prueba el ciclo up -> down -> up de todas las migraciones en una base _test
  e imprime un resumen para pegar (huellas H0..H4, IGUAL/DISTINTO, matriz de
  privilegios, pruebas funcionales y comparacion del catalogo).

.DESCRIPTION
  La base debe estar en la linea base (sin la 017). Pasos:
    1. H0 = huella inicial.
    2. up de todas, incluidas las retenidas. Antes de cada up se guarda la
       huella previa P(N). Al final, H1.
       Justo antes de la 022 (BD-022) se ejecuta pruebas_heredadas.sql: simula
       cursos PUBLICADO sin revisor, aplica dentro de una sola transaccion el
       cuerpo de las migraciones pendientes (las retenidas al final, como en
       Learnity) y lo deshace todo con ROLLBACK. Se exige huella = P(022).
    3. down de todas, de la ultima a la primera. Despues de cada down se
       exige huella = P(N). Al final, H2, y se exige H2 = H0.
    4. up de todas -> H3. Se exige H3 = H1. Pruebas funcionales con todas,
       incluidas las retenidas (la 023).
    5. Estado migrado sin las retenidas: down hasta antes de la primera
       retenida y up del resto (la 023 queda sin aplicar) -> H4.
    6. matriz_privilegios.sql, pruebas_funcionales.sql y comparar_catalogo.sql.
    7. 019b: aplica pruebas/privilegios_pruebas.sql y repite la matriz y las
       pruebas funcionales.
    8. Estado final (-EstadoFinal):
         LineaBase (por defecto): quita la 019b y revierte todo. learnity_test
           vuelve a la linea base y la suite actual sigue en verde (sus
           fixtures todavia no usan el pool de learnity_pruebas; PLAN_BD D-BD2).
         Migrada: deja H4 con la 019b aplicada.
  Las salidas completas quedan en -SalidaDir (por defecto en %TEMP%).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File database\scripts\probar-migraciones.ps1 -Base learnity_test
#>
param(
    [string]$Base = 'learnity_test',
    [string]$Servidor = 'localhost',
    [string]$Puerto = '5432',
    [string]$Usuario = 'postgres',
    [string]$SalidaDir = '',
    [ValidateSet('LineaBase', 'Migrada')][string]$EstadoFinal = 'LineaBase',
    [switch]$PedirEnCadaPaso,
    [string]$PsqlRuta = ''
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\comun.ps1"

if ($Base -notmatch '_test$') { throw "probar-migraciones solo corre en bases _test (recibio '$Base')." }
$cx = @{ Psql = (Resolver-Psql -Ruta $PsqlRuta); Servidor = $Servidor; Puerto = $Puerto; Usuario = $Usuario; Base = $Base }
if (-not $SalidaDir) {
    $SalidaDir = Join-Path $env:TEMP ("learnity-probar-$Base-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
}
New-Item -ItemType Directory -Force -Path $SalidaDir | Out-Null

$resumen = New-Object System.Collections.Generic.List[string]
function Anotar([string]$linea) { $script:resumen.Add($linea); Write-Host $linea }

function Tomar-Huella([string]$Etiqueta) {
    $r = Invocar-Psql -Cx $cx -Argumentos @('-At', '-F', '|', '-f', '..\verificacion\huella_esquema.sql')
    $r.Salida | Set-Content -LiteralPath (Join-Path $SalidaDir "huella-$Etiqueta.txt") -Encoding UTF8
    if ($r.Codigo -ne 0) { throw "Fallo la huella $Etiqueta : $($r.Salida -join ' ')" }
    $h = @{}
    foreach ($l in $r.Salida) {
        $p = $l.Split('|')
        if ($p.Count -eq 3) { $h[$p[0]] = "$($p[1])|$($p[2])" }
    }
    return $h
}

function Comparar-Huellas($A, $B) {
    $claves = @($A.Keys) + @($B.Keys) | Sort-Object -Unique | Where-Object { $_ -ne 'TOTAL' }
    $distintas = @($claves | Where-Object { $A[$_] -ne $B[$_] })
    if ($distintas.Count -eq 0) { return 'IGUAL' }
    return 'DISTINTO (' + ($distintas -join ', ') + ')'
}

# Con -Diferir, las lineas se guardan en $diferidos y se anotan en el paso 6.
$diferidos = New-Object System.Collections.Generic.List[string]
function Ejecutar-Reporte([string]$Archivo, [string]$Titulo, [string]$Nombre = '', [string[]]$Opciones = @(), [switch]$Diferir) {
    $r = Invocar-Psql -Cx $cx -Argumentos (@('-At', '-F', ' | ') + $Opciones + @('-f', $Archivo))
    if (-not $Nombre) { $Nombre = [IO.Path]::GetFileNameWithoutExtension($Archivo) }
    $r.Salida | Set-Content -LiteralPath (Join-Path $SalidaDir "$Nombre.txt") -Encoding UTF8
    $lineas = @('', "--- $Titulo ---") + @($r.Salida | Where-Object { $_ -ne '' } | ForEach-Object { "  $_" })
    if ($r.Codigo -ne 0) { $lineas += "  ERROR: $Archivo termino con codigo $($r.Codigo)" }
    foreach ($l in $lineas) { if ($Diferir) { $script:diferidos.Add($l) } else { Anotar $l } }
}

# BD-022: compone verificacion\pruebas_heredadas.sql sustituyendo la linea
# '-- @migraciones' por el cuerpo de cada migracion pendiente desde $Desde, sin
# su BEGIN ni su COMMIT y seguido de RESET ROLE. Primero las no retenidas en
# orden y al final las retenidas, como se aplicarian en Learnity. Todo queda en
# la transaccion de la prueba, que termina en ROLLBACK.
function Probar-Heredadas([string]$Desde, $Migraciones) {
    $plantilla = [IO.File]::ReadAllText((Join-Path $script:RaizBd 'verificacion\pruebas_heredadas.sql'), [Text.Encoding]::UTF8)
    $partes = [regex]::Split($plantilla, '(?m)^-- @migraciones[ \t]*\r?$')
    if ($partes.Count -ne 2) { throw 'pruebas_heredadas.sql debe tener una sola linea "-- @migraciones".' }
    $retenidas = @(Obtener-Retenidas)
    $pendientes = @($Migraciones | Where-Object { $_.Version -ge $Desde })
    $orden = @($pendientes | Where-Object { $retenidas -notcontains $_.Version }) +
             @($pendientes | Where-Object { $retenidas -contains $_.Version })
    $cuerpos = foreach ($m in $orden) {
        $sql = [IO.File]::ReadAllText($m.RutaUp, [Text.Encoding]::UTF8)
        foreach ($sentencia in 'BEGIN', 'COMMIT') {
            $patron = "(?m)^[ \t]*$sentencia;[ \t]*\r?$"
            if ([regex]::Matches($sql, $patron).Count -ne 1) { throw "$($m.Up) debe tener una sola linea '$sentencia;'." }
            $sql = [regex]::Replace($sql, $patron, "-- ($sentencia de la $($m.Version) omitido: va en la transaccion de la prueba)")
        }
        "-- ===================================== $($m.Up)`n$sql`nRESET ROLE;`n"
    }
    $ruta = Join-Path $SalidaDir 'pruebas_heredadas-compuesto.sql'
    [IO.File]::WriteAllText($ruta, $partes[0] + ($cuerpos -join "`n") + $partes[1], (New-Object Text.UTF8Encoding $false))
    $versiones = ($orden | ForEach-Object { $_.Version }) -join ', '
    Ejecutar-Reporte -Archivo $ruta -Nombre 'pruebas_heredadas' -Opciones @('-q') -Diferir `
        -Titulo "Filas heredadas, BD-022 (migraciones dentro de la prueba: $versiones; n | prueba | esperado | obtenido | resultado)"
}

Push-Location -LiteralPath $script:DirMigracion
Iniciar-Conexion -Usuario $Usuario -PedirEnCadaPaso:$PedirEnCadaPaso
$exito = $true
try {
    if (@(Obtener-Aplicadas -Cx $cx).Count -gt 0) {
        throw "La base $Base ya tiene schema_migraciones. Para empezar desde la linea base: revertir-migraciones.ps1 -Base $Base -Todas"
    }
    $migs = @(Obtener-Migraciones)
    Anotar "=== probar-migraciones | $Base | $(Get-Date -Format 'yyyy-MM-dd HH:mm') | migraciones: $(($migs | ForEach-Object { $_.Version }) -join ', ') ==="

    # 1-2. H0 y up de todas, guardando la huella previa de cada una.
    $h0 = Tomar-Huella 'H0'
    $previas = @{}
    $heredadasSinRastro = 'NO SE EJECUTO'
    foreach ($m in $migs) {
        $previas[$m.Version] = Tomar-Huella "previa-$($m.Version)"
        if ($m.Version -eq '022') {
            Probar-Heredadas -Desde $m.Version -Migraciones $migs
            $heredadasSinRastro = Comparar-Huellas $previas[$m.Version] (Tomar-Huella 'tras-heredadas')
        }
        if (-not (Aplicar-Una -Cx $cx -Migracion $m)) { throw "Fallo el up de la $($m.Version) (primer up)." }
    }
    $h1 = Tomar-Huella 'H1'

    # 3. down de todas, comparando cada paso con su huella previa.
    $porMigracion = New-Object System.Collections.Generic.List[string]
    $h2 = $null
    while ($true) {
        $v = Revertir-Ultima -Cx $cx
        if (-not $v) { break }
        $h2 = Tomar-Huella "despues-down-$v"
        $porMigracion.Add("  down $v deja la huella previa: $(Comparar-Huellas $previas[$v] $h2)")
    }

    # 4. up de todas otra vez.
    foreach ($m in $migs) {
        if (-not (Aplicar-Una -Cx $cx -Migracion $m)) { throw "Fallo el up de la $($m.Version) (segundo up)." }
    }
    $h3 = Tomar-Huella 'H3'
    Ejecutar-Reporte '..\verificacion\pruebas_funcionales.sql' 'Pruebas funcionales con todas las migraciones, incluidas las retenidas (H3)' -Nombre 'pruebas_funcionales-H3' -Diferir

    # 5. Estado final: sin las retenidas.
    $retenidas = @(Obtener-Retenidas)
    if ($retenidas.Count -gt 0) {
        $minRetenida = ($retenidas | Sort-Object)[0]
        while ($true) {
            $ap = @(Obtener-Aplicadas -Cx $cx)
            if ($ap.Count -eq 0 -or $ap[-1].Version -lt $minRetenida) { break }
            Revertir-Ultima -Cx $cx | Out-Null
        }
        $aplicadasAhora = @(Obtener-Aplicadas -Cx $cx | ForEach-Object { $_.Version })
        foreach ($m in $migs) {
            if ($aplicadasAhora -contains $m.Version -or $retenidas -contains $m.Version) { continue }
            if (-not (Aplicar-Una -Cx $cx -Migracion $m)) { throw "Fallo el up de la $($m.Version) (estado final)." }
        }
    }
    $h4 = Tomar-Huella 'H4'

    Anotar ''
    Anotar '--- Huellas (TOTAL: filas|md5) ---'
    Anotar "  H0 inicial            $($h0['TOTAL'])"
    Anotar "  H1 tras up            $($h1['TOTAL'])"
    Anotar "  H2 tras down          $($h2['TOTAL'])"
    Anotar "  H3 tras up otra vez   $($h3['TOTAL'])"
    Anotar "  H4 estado final       $($h4['TOTAL'])"
    Anotar "  H2 = H0: $(Comparar-Huellas $h0 $h2)"
    Anotar "  H3 = H1: $(Comparar-Huellas $h1 $h3)"
    Anotar "  Prueba de filas heredadas sin rastro (huella = previa a la 022): $heredadasSinRastro"
    Anotar '--- Cada down deja la huella previa a su up ---'
    $porMigracion | ForEach-Object { Anotar $_ }
    Anotar "--- Estado migrado (H4) de ${Base}: $((@(Obtener-Aplicadas -Cx $cx) | ForEach-Object { $_.Version }) -join ', ') (retenidas sin aplicar: $($retenidas -join ', ')) ---"

    # 6. Pruebas diferidas (filas heredadas y H3) y verificaciones sobre el estado final.
    $diferidos | ForEach-Object { Anotar $_ }
    Ejecutar-Reporte '..\verificacion\matriz_privilegios.sql' 'Matriz de privilegios (rol | objeto | esperado | concedido | resultado)'
    Ejecutar-Reporte '..\verificacion\pruebas_funcionales.sql' 'Pruebas funcionales (n | prueba | esperado | obtenido | resultado)'
    Ejecutar-Reporte '..\verificacion\comparar_catalogo.sql' 'Catalogo: consultas actuales frente a vistas (comparacion | actual | vista | diferencias | resultado)'

    # 7. 019b sobre el estado migrado.
    $r = Invocar-Psql -Cx $cx -Argumentos @('-q', '-f', '..\pruebas\privilegios_pruebas.sql')
    Anotar ''
    Anotar "--- 019b privilegios_pruebas.sql: codigo $($r.Codigo) ---"
    $r.Salida | Where-Object { $_ -ne '' } | ForEach-Object { Anotar "  $_" }
    if ($r.Codigo -ne 0) { throw 'Fallo privilegios_pruebas.sql (019b).' }
    Ejecutar-Reporte '..\verificacion\matriz_privilegios.sql' 'Matriz de privilegios con la 019b' -Nombre 'matriz_privilegios-019b'
    Ejecutar-Reporte '..\verificacion\pruebas_funcionales.sql' 'Pruebas funcionales con la 019b' -Nombre 'pruebas_funcionales-019b'

    # 8. Estado final.
    if ($EstadoFinal -eq 'LineaBase') {
        $r = Invocar-Psql -Cx $cx -Argumentos @('-q', '-f', '..\pruebas\quitar_privilegios_pruebas.sql')
        if ($r.Codigo -ne 0) { throw "Fallo quitar_privilegios_pruebas.sql: $($r.Salida -join ' ')" }
        while (Revertir-Ultima -Cx $cx) { }
        $hFinal = Tomar-Huella 'final'
        Anotar ''
        Anotar "--- Estado final: linea base. Huella final = H0: $(Comparar-Huellas $h0 $hFinal) ---"
    } else {
        Anotar ''
        Anotar "--- Estado final: migrada (H4) con la 019b: $((@(Obtener-Aplicadas -Cx $cx) | ForEach-Object { $_.Version }) -join ', ') ---"
    }
} catch {
    $exito = $false
    Anotar ''
    Anotar "ERROR: $($_.Exception.Message)"
    $estado = ''
    try { $estado = (@(Obtener-Aplicadas -Cx $cx) | ForEach-Object { $_.Version }) -join ', ' } catch { }
    Anotar "Estado de ${Base} al fallar: $estado"
    Anotar "Para volver a la linea base: revertir-migraciones.ps1 -Base $Base -Todas"
} finally {
    $resumen | Set-Content -LiteralPath (Join-Path $SalidaDir 'resumen.txt') -Encoding UTF8
    Write-Host ''
    Write-Host "Salidas completas en: $SalidaDir"
    Cerrar-Conexion
    Pop-Location
}
if (-not $exito) { exit 1 }
