# =====================================================================
# Funciones comunes de los scripts de migraciones de Learnity.
# Se carga con: . "$PSScriptRoot\comun.ps1"
#
# Contrasenas: ningun script las guarda ni las imprime.
#   * Si PGPASSWORD ya esta definida en la sesion (o existe pgpass.conf),
#     psql la usa.
#   * Si no, se pide una vez con Read-Host (sin eco) y se guarda solo en
#     PGPASSWORD de este proceso. Al terminar se restaura el valor anterior.
#   * Con -PedirEnCadaPaso no se pide nada: psql la pide en cada llamada.
# Mensajes sin tildes: Windows PowerShell 5.1 lee los .ps1 sin BOM como ANSI.
# =====================================================================

$script:RaizBd        = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script:DirMigracion  = Join-Path $script:RaizBd 'migraciones'
$script:Retenidas     = Join-Path $script:DirMigracion 'RETENIDAS.txt'
$script:LineaBase     = @('000', '015', '016')
$script:PgPassAnterior = $null
$script:PgPassFijada   = $false

function Resolver-Psql {
    param([string]$Ruta)
    if ($Ruta) { $candidata = $Ruta }
    elseif ($env:LEARNITY_PSQL) { $candidata = $env:LEARNITY_PSQL }
    else { $candidata = 'C:\Program Files\PostgreSQL\17\bin\psql.exe' }
    if (-not (Test-Path -LiteralPath $candidata)) {
        throw "No se encontro psql en '$candidata'. Indica la ruta con -PsqlRuta o con la variable LEARNITY_PSQL."
    }
    return $candidata
}

function Iniciar-Conexion {
    param([string]$Usuario, [switch]$PedirEnCadaPaso)
    $env:PGCLIENTENCODING = 'UTF8'
    try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }
    if ($PedirEnCadaPaso -or $env:PGPASSWORD) { return }
    $pgpass = Join-Path $env:APPDATA 'postgresql\pgpass.conf'
    if (Test-Path -LiteralPath $pgpass) { return }
    $segura = Read-Host -AsSecureString "Contrasena de $Usuario (no se guarda ni se muestra)"
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
    try {
        $script:PgPassAnterior = $env:PGPASSWORD
        $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
        $script:PgPassFijada = $true
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function Cerrar-Conexion {
    if ($script:PgPassFijada) {
        $env:PGPASSWORD = $script:PgPassAnterior
        $script:PgPassFijada = $false
    }
}

# Ejecuta psql y devuelve @{ Codigo; Salida }. Nunca lanza por la salida de error.
function Invocar-Psql {
    param(
        [Parameter(Mandatory)][hashtable]$Cx,
        [string[]]$Argumentos
    )
    $base = @('-X', '-h', $Cx.Servidor, '-p', $Cx.Puerto, '-U', $Cx.Usuario, '-d', $Cx.Base, '-v', 'ON_ERROR_STOP=1')
    $anterior = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $salida = & $Cx.Psql @base @Argumentos 2>&1 | ForEach-Object { "$_" }
        $codigo = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $anterior
    }
    return @{ Codigo = $codigo; Salida = @($salida) }
}

function Consultar-Valor {
    param([hashtable]$Cx, [string]$Sql)
    $r = Invocar-Psql -Cx $Cx -Argumentos @('-At', '-c', $Sql)
    if ($r.Codigo -ne 0) { throw "Fallo la consulta: $($r.Salida -join ' ')" }
    return (($r.Salida | Where-Object { $_ -ne '' }) -join "`n").Trim()
}

# sha256 del archivo con finales de linea normalizados a LF (igual en cualquier checkout).
function Obtener-Checksum {
    param([string]$Ruta)
    $texto = [IO.File]::ReadAllText($Ruta, [Text.Encoding]::UTF8) -replace "`r`n", "`n"
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        return (($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($texto)) | ForEach-Object { $_.ToString('x2') }) -join '')
    } finally { $sha.Dispose() }
}

function Obtener-Migraciones {
    Get-ChildItem -LiteralPath $script:DirMigracion -Filter '*.up.sql' |
        Where-Object { $_.Name -match '^\d{3}_' } |
        Sort-Object Name |
        ForEach-Object {
            $version = $_.Name.Substring(0, 3)
            $down = Join-Path $script:DirMigracion ($_.Name -replace '\.up\.sql$', '.down.sql')
            [pscustomobject]@{ Version = $version; Up = $_.Name; Down = (Split-Path $down -Leaf); RutaUp = $_.FullName }
        }
}

function Obtener-Retenidas {
    if (-not (Test-Path -LiteralPath $script:Retenidas)) { return @() }
    Get-Content -LiteralPath $script:Retenidas |
        ForEach-Object { ($_ -replace '#.*$', '').Trim() } |
        Where-Object { $_ -match '^\d{3}$' }
}

# Devuelve las migraciones aplicadas en orden: objetos con Version y Checksum.
function Obtener-Aplicadas {
    param([hashtable]$Cx)
    $existe = Consultar-Valor -Cx $Cx -Sql "SELECT to_regclass('public.schema_migraciones') IS NOT NULL"
    if ($existe -ne 't') { return @() }
    $filas = Invocar-Psql -Cx $Cx -Argumentos @('-At', '-F', '|', '-c', 'SELECT version, COALESCE(checksum, '''') FROM schema_migraciones ORDER BY orden')
    if ($filas.Codigo -ne 0) { throw "No se pudo leer schema_migraciones: $($filas.Salida -join ' ')" }
    $filas.Salida | Where-Object { $_ -match '\|' } | ForEach-Object {
        $p = $_.Split('|')
        [pscustomobject]@{ Version = $p[0]; Checksum = $p[1] }
    }
}

function Exigir-Respaldo {
    param([string]$Base, [switch]$ConfirmoRespaldo)
    if ($Base -match '_test$') { return }
    if (-not $ConfirmoRespaldo) {
        throw ("La base '$Base' no es de pruebas. Antes: Puerta DB aprobada, pg_dump -F c fuera del repositorio " +
               "(database/README.md) y aprobacion del usuario. Despues repite con -ConfirmoRespaldo.")
    }
}

# Aplica un up (y registra su checksum). Devuelve $true si salio bien.
function Aplicar-Una {
    param([hashtable]$Cx, $Migracion)
    $checksum = Obtener-Checksum -Ruta $Migracion.RutaUp
    Write-Host "  up   $($Migracion.Up)"
    $r = Invocar-Psql -Cx $Cx -Argumentos @('-q', '-f', $Migracion.Up, '-c',
        "UPDATE schema_migraciones SET checksum = '$checksum' WHERE version = '$($Migracion.Version)'")
    $r.Salida | Where-Object { $_ -ne '' } | ForEach-Object { Write-Host "       $_" }
    return ($r.Codigo -eq 0)
}

# Revierte la ultima aplicada. Devuelve la version revertida o $null si no hay nada que revertir.
function Revertir-Ultima {
    param([hashtable]$Cx)
    $aplicadas = @(Obtener-Aplicadas -Cx $Cx)
    if ($aplicadas.Count -eq 0) { return $null }
    $ultima = $aplicadas[-1].Version
    if ($script:LineaBase -contains $ultima) { return $null }
    $m = Obtener-Migraciones | Where-Object { $_.Version -eq $ultima }
    if (-not $m) { throw "No existe el archivo .down.sql de la migracion $ultima." }
    Write-Host "  down $($m.Down)"
    $r = Invocar-Psql -Cx $Cx -Argumentos @('-q', '-f', $m.Down)
    $r.Salida | Where-Object { $_ -ne '' } | ForEach-Object { Write-Host "       $_" }
    if ($r.Codigo -ne 0) { throw "Fallo el down de la $ultima." }
    return $ultima
}
