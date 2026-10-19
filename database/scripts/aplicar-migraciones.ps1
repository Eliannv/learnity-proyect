<#
.SYNOPSIS
  Aplica en orden las migraciones pendientes (database/migraciones/0NN_*.up.sql).

.DESCRIPTION
  Lee schema_migraciones, salta las aplicadas (y avisa si su archivo cambio
  despues de aplicarse), salta las de RETENIDAS.txt salvo con
  -IncluirRetenidas y las indicadas en -Omitir, y se detiene en -Hasta.
  Registra el sha256 de cada .up.sql en schema_migraciones.checksum.
  En una base que no termina en _test exige -ConfirmoRespaldo: antes van la
  Puerta DB, el pg_dump y la aprobacion del usuario (database/README.md).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File database\scripts\aplicar-migraciones.ps1 -Base learnity_test
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File database\scripts\aplicar-migraciones.ps1 -Base Learnity -ConfirmoRespaldo
.EXAMPLE
  ... -Base learnity_test -Omitir 022,023      # opcion C de D-BD1
#>
param(
    [Parameter(Mandatory)][string]$Base,
    [string]$Servidor = 'localhost',
    [string]$Puerto = '5432',
    [string]$Usuario = 'postgres',
    [string]$Hasta = '',
    [string[]]$Omitir = @(),
    [switch]$IncluirRetenidas,
    [switch]$Simular,
    [switch]$ConfirmoRespaldo,
    [switch]$PedirEnCadaPaso,
    [string]$PsqlRuta = ''
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\comun.ps1"

Exigir-Respaldo -Base $Base -ConfirmoRespaldo:$ConfirmoRespaldo
$cx = @{ Psql = (Resolver-Psql -Ruta $PsqlRuta); Servidor = $Servidor; Puerto = $Puerto; Usuario = $Usuario; Base = $Base }
$Omitir = @($Omitir | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })

Push-Location -LiteralPath $script:DirMigracion
Iniciar-Conexion -Usuario $Usuario -PedirEnCadaPaso:$PedirEnCadaPaso
$fallo = $false
try {
    $aplicadas = @(Obtener-Aplicadas -Cx $cx)
    $retenidas = @(Obtener-Retenidas)
    Write-Host "Base: $Base  |  aplicadas: $(($aplicadas | ForEach-Object { $_.Version }) -join ', ')"

    foreach ($m in Obtener-Migraciones) {
        if ($Hasta -and $m.Version -gt $Hasta) { break }
        $ya = $aplicadas | Where-Object { $_.Version -eq $m.Version }
        if ($ya) {
            $actual = Obtener-Checksum -Ruta $m.RutaUp
            if ($ya.Checksum -and $ya.Checksum -ne $actual) {
                Write-Warning "La $($m.Version) ya esta aplicada, pero su archivo cambio despues (checksum distinto)."
            }
            continue
        }
        if ($Omitir -contains $m.Version) { Write-Host "  omitida  $($m.Up)"; continue }
        if (($retenidas -contains $m.Version) -and -not $IncluirRetenidas) { Write-Host "  retenida $($m.Up) (RETENIDAS.txt)"; continue }
        if ($Simular) { Write-Host "  pendiente $($m.Up)"; continue }
        if (-not (Aplicar-Una -Cx $cx -Migracion $m)) {
            Write-Host "ERROR: fallo $($m.Up). No se aplico nada mas." -ForegroundColor Red
            $fallo = $true
            break
        }
    }
    $final = @(Obtener-Aplicadas -Cx $cx | ForEach-Object { $_.Version }) -join ', '
    Write-Host "Aplicadas ahora en ${Base}: $final"
} finally {
    Cerrar-Conexion
    Pop-Location
}
if ($fallo) { exit 1 }
