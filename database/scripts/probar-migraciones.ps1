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
    3. down de todas, de la ultima a la primera. Despues de cada down se
       exige huella = P(N). Al final, H2, y se exige H2 = H0.
    4. up de todas -> H3. Se exige H3 = H1.
    5. Estado final para la suite: down hasta la 022 y up de las pendientes
       sin las retenidas (la 023 queda sin aplicar) -> H4.
    6. matriz_privilegios.sql, pruebas_funcionales.sql y comparar_catalogo.sql.
    7. Con -AplicarPrivilegiosPruebas, aplica pruebas/privilegios_pruebas.sql
       (019b) y repite la matriz.
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
    [switch]$AplicarPrivilegiosPruebas,
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

function Ejecutar-Reporte([string]$Archivo, [string]$Titulo) {
    $r = Invocar-Psql -Cx $cx -Argumentos @('-At', '-F', ' | ', '-f', $Archivo)
    $nombre = [IO.Path]::GetFileNameWithoutExtension($Archivo)
    $r.Salida | Set-Content -LiteralPath (Join-Path $SalidaDir "$nombre.txt") -Encoding UTF8
    Anotar ''
    Anotar "--- $Titulo ---"
    $r.Salida | Where-Object { $_ -ne '' } | ForEach-Object { Anotar "  $_" }
    if ($r.Codigo -ne 0) { Anotar "  ERROR: $Archivo termino con codigo $($r.Codigo)" }
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
    foreach ($m in $migs) {
        $previas[$m.Version] = Tomar-Huella "previa-$($m.Version)"
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
    Anotar '--- Cada down deja la huella previa a su up ---'
    $porMigracion | ForEach-Object { Anotar $_ }
    Anotar "--- Estado final de ${Base}: $((@(Obtener-Aplicadas -Cx $cx) | ForEach-Object { $_.Version }) -join ', ') (retenidas sin aplicar: $($retenidas -join ', ')) ---"

    # 6. Verificaciones sobre el estado final.
    Ejecutar-Reporte '..\verificacion\matriz_privilegios.sql' 'Matriz de privilegios (rol | objeto | esperado | concedido | resultado)'
    Ejecutar-Reporte '..\verificacion\pruebas_funcionales.sql' 'Pruebas funcionales (n | prueba | esperado | obtenido | resultado)'
    Ejecutar-Reporte '..\verificacion\comparar_catalogo.sql' 'Catalogo: consultas actuales frente a vistas (comparacion | actual | vista | diferencias | resultado)'

    # 7. 019b, si se pidio.
    if ($AplicarPrivilegiosPruebas) {
        $r = Invocar-Psql -Cx $cx -Argumentos @('-q', '-f', '..\pruebas\privilegios_pruebas.sql')
        Anotar ''
        Anotar "--- 019b privilegios_pruebas.sql: codigo $($r.Codigo) ---"
        $r.Salida | Where-Object { $_ -ne '' } | ForEach-Object { Anotar "  $_" }
        Ejecutar-Reporte '..\verificacion\matriz_privilegios.sql' 'Matriz de privilegios tras 019b'
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
