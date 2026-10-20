# Prepara dos bases locales y los .env del backend para Sprint 3.
# Ejecutar desde cualquier carpeta con:
# powershell -ExecutionPolicy Bypass -File database\scripts\preparar-entorno-sprint3.ps1
[CmdletBinding()]
param(
    [string]$Servidor = 'localhost',
    [int]$Puerto = 5432,
    [string]$BaseDesarrollo = 'learnity_s3_dev',
    [string]$BasePruebas = 'learnity_test',
    [string]$PsqlRuta = '',
    [switch]$SoloPlan
)

$ErrorActionPreference = 'Stop'
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
. "$PSScriptRoot\comun.ps1"

function Exigir-Nombre([string]$Nombre, [bool]$EsPrueba) {
    if ($Nombre -cnotmatch '^[a-z][a-z0-9_]{0,62}$' -or
        (@('learnity', 'postgres', 'template0', 'template1') -contains $Nombre)) {
        throw "Nombre de base no permitido: $Nombre"
    }
    if ($EsPrueba -ne $Nombre.EndsWith('_test')) {
        throw "La base de pruebas debe terminar en _test y la de desarrollo no: $Nombre"
    }
}

Exigir-Nombre $BaseDesarrollo $false
Exigir-Nombre $BasePruebas $true
if ($BaseDesarrollo -eq $BasePruebas) { throw 'Las dos bases deben tener nombres distintos.' }

Write-Host "Bases locales previstas: $BaseDesarrollo (desarrollo), $BasePruebas (pruebas)."
Write-Host 'No se toca la base Learnity ni se suben contrasenas a Git.'
if ($SoloPlan) { return }

$respuesta = Read-Host 'Para continuar escribe PREPARAR'
if ($respuesta -cne 'PREPARAR') { throw 'Cancelado sin cambios.' }

$psql = Resolver-Psql -Ruta $PsqlRuta
$reconstruir = Join-Path $PSScriptRoot 'reconstruir-base.ps1'
$envDev = Join-Path $raiz 'backend\.env'
$envTest = Join-Path $raiz 'backend\.env.test'
$pgPassAnterior = $env:PGPASSWORD

function Texto-Seguro([Security.SecureString]$Valor) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Valor)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Nueva-Clave {
    $bytes = New-Object byte[] 48
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Psql-Admin([string]$Sql) {
    $salida = & $psql -X -w -q -At -h $Servidor -p $Puerto -U postgres -d postgres -v ON_ERROR_STOP=1 -c $Sql 2>&1
    if ($LASTEXITCODE -ne 0) { throw "No se pudo conectar a PostgreSQL como postgres. Comprueba la contrasena y el puerto $Puerto." }
    return (($salida | ForEach-Object { "$_" }) -join "`n").Trim()
}

function Cambiar-Clave-Rol([string]$Operacion, [string]$Clave) {
    # La clave viaja por stdin a psql, nunca como argumento del proceso ni en la salida.
    $literal = $Clave.Replace("'", "''")
    if ($Operacion -eq 'CREATE') { $sql = "CREATE ROLE learnity_app LOGIN PASSWORD '$literal';" }
    elseif ($Operacion -eq 'ALTER') { $sql = "ALTER ROLE learnity_app WITH LOGIN PASSWORD '$literal';" }
    else { throw 'Operacion de rol no admitida.' }
    $sql | & $psql -X -w -q -h $Servidor -p $Puerto -U postgres -d postgres -v ON_ERROR_STOP=1 -f - | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo configurar el rol learnity_app.' }
}

function Confirmar-Base([string]$Nombre) {
    $existe = Psql-Admin "SELECT 1 FROM pg_database WHERE datname = '$Nombre'"
    if ($existe -eq '1') {
        Write-Warning "La base $Nombre ya existe. Su reconstruccion BORRARA sus datos."
        $confirmacion = Read-Host "Si es desechable, escribe exactamente BORRAR $Nombre"
        if ($confirmacion -cne "BORRAR $Nombre") { throw "Cancelado: se conservo $Nombre." }
    }
}

function Probar-App([string]$Clave) {
    $anterior = $env:PGPASSWORD
    try {
        $env:PGPASSWORD = $Clave
        try {
            $salida = & $psql -X -w -q -At -h $Servidor -p $Puerto -U learnity_app -d $BaseDesarrollo -v ON_ERROR_STOP=1 -c 'SELECT current_user' 2>$null
            return ($LASTEXITCODE -eq 0 -and (($salida | ForEach-Object { "$_" }) -join '').Trim() -eq 'learnity_app')
        } catch { return $false }
    } finally { $env:PGPASSWORD = $anterior }
}

function Establecer-Env([string]$Ruta, [string]$Clave, [string]$Valor) {
    $lineas = [Collections.Generic.List[string]]::new()
    $lineas.AddRange([string[]][IO.File]::ReadAllLines($Ruta))
    $patron = '^' + [regex]::Escape($Clave) + '='
    $encontrado = $false
    for ($i = 0; $i -lt $lineas.Count; $i++) {
        if ($lineas[$i] -match $patron) {
            $lineas[$i] = "$Clave=$Valor"
            $encontrado = $true
            break
        }
    }
    if (-not $encontrado) { $lineas.Add("$Clave=$Valor") }
    [IO.File]::WriteAllLines($Ruta, $lineas.ToArray(), (New-Object Text.UTF8Encoding($false)))
}

try {
    $segura = Read-Host -AsSecureString 'Contrasena local de postgres (no se muestra)'
    $env:PGPASSWORD = Texto-Seguro $segura
    if ((Psql-Admin 'SELECT 1') -ne '1') { throw 'No se pudo verificar PostgreSQL.' }

    # Se comprueba antes de cambiar roles, bases o archivos.
    Confirmar-Base $BaseDesarrollo
    Confirmar-Base $BasePruebas

    $rolExiste = (Psql-Admin "SELECT 1 FROM pg_roles WHERE rolname = 'learnity_app'") -eq '1'
    if ($rolExiste) {
        Write-Host 'El rol learnity_app ya existe. Se conservara su clave si la conoces.'
        $appSegura = Read-Host -AsSecureString 'Contrasena local existente de learnity_app (Enter si no la conoces)'
        $appClave = if ($null -eq $appSegura) { '' } else { Texto-Seguro $appSegura }
    } else {
        $appClave = Nueva-Clave
        Cambiar-Clave-Rol 'CREATE' $appClave
        Write-Host 'Se creo el rol local learnity_app con una clave aleatoria.'
    }

    Write-Host "Reconstruyendo $BaseDesarrollo ..."
    & $reconstruir -Base $BaseDesarrollo -Servidor $Servidor -Puerto "$Puerto" -Usuario postgres -PsqlRuta $psql -ConfirmoBorrar $BaseDesarrollo
    if ($LASTEXITCODE -ne 0) { throw "Fallo la reconstruccion de $BaseDesarrollo." }
    Write-Host "Reconstruyendo $BasePruebas ..."
    & $reconstruir -Base $BasePruebas -Servidor $Servidor -Puerto "$Puerto" -Usuario postgres -PsqlRuta $psql
    if ($LASTEXITCODE -ne 0) { throw "Fallo la reconstruccion de $BasePruebas." }

    if (-not $appClave -or $appClave -cnotmatch '^[A-Za-z0-9_-]+$' -or -not (Probar-App $appClave)) {
        Write-Warning 'La clave de learnity_app no funciona o no puede guardarse sin ambiguedad en .env.'
        $cambio = Read-Host 'Para cambiar SOLO la clave de ese rol local, escribe CAMBIAR CLAVE'
        if ($cambio -cne 'CAMBIAR CLAVE') { throw 'Bases creadas; .env intactos. Falta la clave correcta de learnity_app.' }
        $appClave = Nueva-Clave
        $env:PGPASSWORD = Texto-Seguro $segura
        Cambiar-Clave-Rol 'ALTER' $appClave
        if (-not (Probar-App $appClave)) { throw 'No se pudo verificar la nueva clave de learnity_app.' }
    }

    $nuevoDev = -not (Test-Path -LiteralPath $envDev)
    $nuevoTest = -not (Test-Path -LiteralPath $envTest)
    if ($nuevoDev) { Copy-Item -LiteralPath (Join-Path $raiz 'backend\.env.example') -Destination $envDev }
    if ($nuevoTest) { Copy-Item -LiteralPath (Join-Path $raiz 'backend\.env.test.example') -Destination $envTest }
    foreach ($config in @(@{ Ruta=$envDev; Base=$BaseDesarrollo }, @{ Ruta=$envTest; Base=$BasePruebas })) {
        Establecer-Env $config.Ruta 'DB_HOST' $Servidor
        Establecer-Env $config.Ruta 'DB_PORT' "$Puerto"
        Establecer-Env $config.Ruta 'DB_NAME' $config.Base
        Establecer-Env $config.Ruta 'DB_USER' 'learnity_app'
        Establecer-Env $config.Ruta 'DB_PASSWORD' $appClave
    }
    if ($nuevoDev) {
        Establecer-Env $envDev 'JWT_SECRET' (Nueva-Clave)
        Establecer-Env $envDev 'SEED_PASSWORD' (Nueva-Clave)
    }
    if ($nuevoTest) { Establecer-Env $envTest 'JWT_SECRET' (Nueva-Clave) }
    Write-Host 'LISTO: bases y backend/.env + backend/.env.test configurados localmente.'
    Write-Host 'La base Learnity no se toco. Ningun secreto se imprimio.'
} finally {
    $env:PGPASSWORD = $pgPassAnterior
    $appClave = $null
}
