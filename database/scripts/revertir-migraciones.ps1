<#
.SYNOPSIS
  Revierte migraciones aplicadas, de la ultima hacia atras (.down.sql).

.DESCRIPTION
  -Cantidad N revierte las N ultimas (por defecto 1).
  -Hasta 0NN revierte hasta que la ultima aplicada sea la 0NN.
  -Todas revierte todas, incluida la 017 (deja la base como antes de la 017).
  Nunca toca la linea base (000, 015 y 016).
  En una base que no termina en _test exige -ConfirmoRespaldo.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File database\scripts\revertir-migraciones.ps1 -Base learnity_test
.EXAMPLE
  ... -Base learnity_test -Hasta 022
#>
param(
    [Parameter(Mandatory)][string]$Base,
    [string]$Servidor = 'localhost',
    [string]$Puerto = '5432',
    [string]$Usuario = 'postgres',
    [int]$Cantidad = 1,
    [string]$Hasta = '',
    [switch]$Todas,
    [switch]$ConfirmoRespaldo,
    [switch]$PedirEnCadaPaso,
    [string]$PsqlRuta = ''
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\comun.ps1"

Exigir-Respaldo -Base $Base -ConfirmoRespaldo:$ConfirmoRespaldo
$cx = @{ Psql = (Resolver-Psql -Ruta $PsqlRuta); Servidor = $Servidor; Puerto = $Puerto; Usuario = $Usuario; Base = $Base }

Push-Location -LiteralPath $script:DirMigracion
Iniciar-Conexion -Usuario $Usuario -PedirEnCadaPaso:$PedirEnCadaPaso
$fallo = $false
try {
    $hechas = 0
    while ($true) {
        if (-not $Todas -and -not $Hasta -and $hechas -ge $Cantidad) { break }
        if ($Hasta) {
            $ultima = @(Obtener-Aplicadas -Cx $cx)
            if ($ultima.Count -eq 0 -or $ultima[-1].Version -le $Hasta) { break }
        }
        $v = Revertir-Ultima -Cx $cx
        if (-not $v) { break }
        $hechas++
    }
    $final = @(Obtener-Aplicadas -Cx $cx | ForEach-Object { $_.Version }) -join ', '
    if (-not $final) { $final = '(sin schema_migraciones)' }
    Write-Host "Revertidas: $hechas. Aplicadas ahora en ${Base}: $final"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    $fallo = $true
} finally {
    Cerrar-Conexion
    Pop-Location
}
if ($fallo) { exit 1 }
