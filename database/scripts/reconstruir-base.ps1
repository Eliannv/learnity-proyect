<#
.SYNOPSIS
  Reconstruye una base de Learnity desde cero con el esquema final y la
  verifica: borra la base, la crea vacia, aplica la linea base y las
  migraciones en orden y, solo en bases _test, la 019b.

.DESCRIPTION
  Pasos:
    1. Comprobaciones del cluster (conectado a la base de mantenimiento
       'postgres'): superusuario, PostgreSQL 16 o superior y que learnity_app
       exista (no se crea, no se modifica y su contrasena no se toca). Informa
       de los roles learnity_* que ya existen, de los logins que no podran
       conectarse a la base nueva (riesgo R1) y, si la base existe, de lo que
       tiene y de las conexiones que se van a cerrar.
    2. DROP DATABASE IF EXISTS ... WITH (FORCE) y CREATE DATABASE ...
       TEMPLATE template0 ENCODING 'UTF8'.
    3. Linea base: learnity_esquema.sql (en una sola transaccion), 015, 016 y
       linea_base_permisos.sql (los GRANT de la seccion 14 del README
       principal). Huella comparada con la de referencia H0.
    4. Migraciones desde la 017, en orden, con la misma funcion que
       aplicar-migraciones.ps1: cada una se registra en schema_migraciones con
       su sha256. Las de RETENIDAS.txt (hoy ninguna) no se aplican salvo
       con -IncluirRetenidas. Huella comparada con la de referencia H1 (con la
       023) o, si la 023 quedara sin aplicar, H4.
    5. Solo en bases _test: pruebas\privilegios_pruebas.sql (019b).
    6. Verificacion: esquema_final.sql y matriz_privilegios.sql; en bases
       _test, ademas pruebas_funcionales.sql y comparar_catalogo.sql (las dos
       lo deshacen todo con ROLLBACK).
  Imprime un resumen para pegar y deja las salidas completas en -SalidaDir
  (por defecto en %TEMP%). Termina con codigo 1 si algo falla o difiere.

  Roles: los del cluster se reutilizan si ya existen (la 018 solo crea los que
  faltan). DROP DATABASE no borra roles.

  Una base cuyo nombre no termina en _test exige -ConfirmoBorrar con el nombre
  exacto de la base. Antes van el pg_dump y la aprobacion del usuario
  (database/README.md, "Reconstruir Learnity").

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File database\scripts\reconstruir-base.ps1 -Base learnity_test
.EXAMPLE
  ... -Base learnity_test -Simular            # solo muestra el plan, no se conecta
.EXAMPLE
  ... -Base learnity_test -SoloLineaBase      # deja la linea base (para probar-migraciones.ps1)
.EXAMPLE
  ... -Base Learnity -ConfirmoBorrar Learnity # SOLO con aprobacion del usuario y respaldo
#>
param(
    [string]$Base = 'learnity_test',
    [string]$Servidor = 'localhost',
    [string]$Puerto = '5432',
    [string]$Usuario = 'postgres',
    [string]$ConfirmoBorrar = '',
    [switch]$IncluirRetenidas,
    [switch]$SoloLineaBase,
    [switch]$Simular,
    [string]$SalidaDir = '',
    [switch]$PedirEnCadaPaso,
    [string]$PsqlRuta = ''
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\comun.ps1"

# --- Nombre de la base y confirmacion ----------------------------------------
if ($Base -cnotmatch '^[A-Za-z_][A-Za-z0-9_]{0,62}$') {
    throw "Nombre de base no admitido: '$Base'. Solo letras ASCII, digitos y _ (maximo 63)."
}
if (@('postgres', 'template0', 'template1') -contains $Base.ToLower()) {
    throw "La base '$Base' es del sistema: no se reconstruye."
}
$esTest = $Base -cmatch '_test$'
if (-not $esTest -and $ConfirmoBorrar -cne $Base) {
    throw ("La base '$Base' no es de pruebas y este script la BORRA. Antes: aprobacion del usuario y " +
           "pg_dump -F c fuera del repositorio (database/README.md, 'Reconstruir Learnity'). " +
           "Despues repite con -ConfirmoBorrar $Base.")
}

$migraciones = @(Obtener-Migraciones)
$retenidas = @(Obtener-Retenidas)
$aAplicar = @($migraciones | Where-Object { $IncluirRetenidas -or ($retenidas -notcontains $_.Version) })
$omitidas = @($migraciones | Where-Object { -not ($IncluirRetenidas -or ($retenidas -notcontains $_.Version)) })

if ($Simular) {
    Write-Host "=== reconstruir-base (SIMULACION, no se conecta) | $Base ==="
    Write-Host "  1. Comprobar: superusuario, PostgreSQL 16+, learnity_app existe"
    Write-Host "  2. DROP DATABASE IF EXISTS `"$Base`" WITH (FORCE); CREATE DATABASE `"$Base`" TEMPLATE template0 ENCODING 'UTF8'"
    Write-Host "  3. Linea base: learnity_esquema.sql, 015_sesiones_y_recuperacion.sql, 016_limpieza_pdf.sql, linea_base_permisos.sql"
    if ($SoloLineaBase) {
        Write-Host "  (-SoloLineaBase: sin migraciones, sin 019b)"
    } else {
        Write-Host "  4. Migraciones: $(($aAplicar | ForEach-Object { $_.Version }) -join ', ')"
        if ($omitidas.Count -gt 0) { Write-Host "     Retenidas, sin aplicar: $(($omitidas | ForEach-Object { $_.Version }) -join ', ')" }
        if ($esTest) { Write-Host "  5. 019b: pruebas\privilegios_pruebas.sql" } else { Write-Host "  5. 019b: NO (la base no es _test)" }
        $verif = 'esquema_final.sql, matriz_privilegios.sql'
        if ($esTest) { $verif += ', pruebas_funcionales.sql, comparar_catalogo.sql' }
        Write-Host "  6. Verificacion: $verif"
    }
    exit 0
}

$psql = Resolver-Psql -Ruta $PsqlRuta
$cxAdmin = @{ Psql = $psql; Servidor = $Servidor; Puerto = $Puerto; Usuario = $Usuario; Base = 'postgres' }
$cx = @{ Psql = $psql; Servidor = $Servidor; Puerto = $Puerto; Usuario = $Usuario; Base = $Base }
if (-not $SalidaDir) {
    $SalidaDir = Join-Path $env:TEMP ("learnity-reconstruir-$Base-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
}
New-Item -ItemType Directory -Force -Path $SalidaDir | Out-Null

$resumen = New-Object System.Collections.Generic.List[string]
function Anotar([string]$linea) { $script:resumen.Add($linea); Write-Host $linea }

function Ejecutar-Archivo([string]$Archivo, [string]$Paso, [string[]]$Opciones = @()) {
    $r = Invocar-Psql -Cx $cx -Argumentos (@('-q') + $Opciones + @('-f', $Archivo))
    $avisos = @($r.Salida | Where-Object { $_ -ne '' })
    $avisos | Set-Content -LiteralPath (Join-Path $SalidaDir "paso-$Paso.txt") -Encoding UTF8
    $avisos | ForEach-Object { Anotar "       $_" }
    if ($r.Codigo -ne 0) { throw "Fallo $Archivo (codigo $($r.Codigo))." }
}

# Huella (verificacion\huella_esquema.sql) como tabla categoria -> "filas|md5".
function Tomar-Huella([string]$Etiqueta) {
    $r = Invocar-Psql -Cx $cx -Argumentos @('-At', '-F', '|', '-f', '..\verificacion\huella_esquema.sql')
    $r.Salida | Set-Content -LiteralPath (Join-Path $SalidaDir "huella-$Etiqueta.txt") -Encoding UTF8
    if ($r.Codigo -ne 0) { throw "Fallo la huella $Etiqueta : $($r.Salida -join ' ')" }
    return (Convertir-Huella $r.Salida)
}

function Convertir-Huella([string[]]$Lineas) {
    $h = @{}
    foreach ($l in $Lineas) {
        if ($l -match '^\s*#') { continue }
        $p = $l.Trim().Split('|')
        if ($p.Count -eq 3) { $h[$p[0]] = "$($p[1])|$($p[2])" }
    }
    return $h
}

function Leer-Referencia([string]$Nombre) {
    $ruta = Join-Path $script:RaizBd "verificacion\referencias\$Nombre"
    if (-not (Test-Path -LiteralPath $ruta)) { throw "Falta la huella de referencia $ruta." }
    return (Convertir-Huella (Get-Content -LiteralPath $ruta -Encoding UTF8))
}

function Comparar-Huellas($A, $B) {
    $claves = @($A.Keys) + @($B.Keys) | Sort-Object -Unique | Where-Object { $_ -ne 'TOTAL' }
    $distintas = @($claves | Where-Object { $A[$_] -ne $B[$_] })
    if ($distintas.Count -eq 0) { return 'IGUAL' }
    $texto = 'DISTINTO (' + ($distintas -join ', ') + ')'
    if ($distintas.Count -eq 1 -and $distintas[0] -eq 'roles') {
        $texto += ' - solo difieren los roles del cluster: ya existian de antes (ver database/README.md)'
    }
    return $texto
}

# Una diferencia solo en los roles del cluster no es un fallo: los roles ya existian de antes.
function Huella-Aceptable([string]$Comparacion) {
    return ($Comparacion -eq 'IGUAL' -or $Comparacion -like '*solo difieren los roles*')
}

# Ejecuta un .sql de verificacion, anota su salida y devuelve la ultima columna de su fila RESUMEN.
function Ejecutar-Verificacion([string]$Archivo, [string]$Titulo) {
    $r = Invocar-Psql -Cx $cx -Argumentos @('-q', '-At', '-F', ' | ', '-f', $Archivo)
    $nombre = [IO.Path]::GetFileNameWithoutExtension($Archivo)
    $r.Salida | Set-Content -LiteralPath (Join-Path $SalidaDir "$nombre.txt") -Encoding UTF8
    Anotar ''
    Anotar "--- $Titulo ---"
    $r.Salida | Where-Object { $_ -ne '' } | ForEach-Object { Anotar "  $_" }
    if ($r.Codigo -ne 0) { Anotar "  ERROR: $Archivo termino con codigo $($r.Codigo)"; return 'ERROR' }
    $fila = @($r.Salida | Where-Object { $_ -match '^(\d+ \| )?RESUMEN \| ' }) | Select-Object -Last 1
    if (-not $fila) { return 'SIN RESUMEN' }
    return ($fila.Split('|')[-1]).Trim()
}

Push-Location -LiteralPath $script:DirMigracion
Iniciar-Conexion -Usuario $Usuario -PedirEnCadaPaso:$PedirEnCadaPaso
$exito = $true
try {
    Anotar "=== reconstruir-base | $Base | $Servidor`:$Puerto | $(Get-Date -Format 'yyyy-MM-dd HH:mm') ==="

    # 1. Comprobaciones del cluster.
    $pre = Consultar-Valor -Cx $cxAdmin -Sql ("SELECT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user)::TEXT || '|' || " +
        "current_setting('server_version_num') || '|' || EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'learnity_app')::TEXT")
    $p = $pre.Split('|')
    if ($p[0] -ne 'true') { throw "Hace falta un superusuario (conectado como $Usuario)." }
    if ([int]$p[1] -lt 160000) { throw "Hace falta PostgreSQL 16 o superior (server_version_num = $($p[1]))." }
    if ($p[2] -ne 'true') {
        throw "Falta el rol learnity_app en este servidor. Este script no lo crea: ver database/README.md, 'Rol learnity_app'."
    }
    $roles = Consultar-Valor -Cx $cxAdmin -Sql ("SELECT COALESCE(string_agg(rolname || CASE WHEN rolcanlogin THEN ' (LOGIN)' ELSE '' END, ', ' ORDER BY rolname), '-') " +
        "FROM pg_roles WHERE rolname LIKE 'learnity\_%'")
    Anotar "  PostgreSQL $($p[1]) | roles learnity_* que ya existen: $roles"
    $logins = Consultar-Valor -Cx $cxAdmin -Sql ("SELECT COALESCE(string_agg(rolname, ', ' ORDER BY rolname), '-') FROM pg_roles " +
        "WHERE rolcanlogin AND NOT rolsuper AND rolname <> 'learnity_app'")
    Anotar "  Logins sin CONNECT en la base nueva (riesgo R1; la 018 lo retira a PUBLIC): $logins"

    $existe = Consultar-Valor -Cx $cxAdmin -Sql "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$Base')::TEXT"
    if ($existe -eq 'true') {
        $conexiones = Consultar-Valor -Cx $cxAdmin -Sql "SELECT count(*) FROM pg_stat_activity WHERE datname = '$Base'"
        $antes = @(Obtener-Aplicadas -Cx $cx | ForEach-Object { $_.Version }) -join ', '
        if (-not $antes) { $antes = 'sin schema_migraciones (linea base)' }
        $filas = Consultar-Valor -Cx $cx -Sql ("SELECT COALESCE(string_agg(relname || '=' || n_live_tup, ', ' ORDER BY relname), '-') " +
            "FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname IN ('archivo', 'curso', 'persona', 'usuario')")
        Anotar "  La base $Base existe: migraciones $antes | filas aprox.: $filas | conexiones que se cierran: $conexiones"
    } else {
        Anotar "  La base $Base no existe: se crea."
    }

    # 2. Borrar y crear. Va en un archivo: PowerShell 5.1 no pasa bien comillas dobles a psql.
    $sqlCrear = Join-Path $SalidaDir 'crear-base.sql'
    $texto = "DROP DATABASE IF EXISTS `"$Base`" WITH (FORCE);`nCREATE DATABASE `"$Base`" TEMPLATE template0 ENCODING 'UTF8';`n"
    [IO.File]::WriteAllText($sqlCrear, $texto, (New-Object Text.UTF8Encoding $false))
    $r = Invocar-Psql -Cx $cxAdmin -Argumentos @('-q', '-f', $sqlCrear)
    $r.Salida | Where-Object { $_ -ne '' } | ForEach-Object { Anotar "       $_" }
    if ($r.Codigo -ne 0) { throw "Fallo DROP/CREATE DATABASE $Base." }
    $cod = Consultar-Valor -Cx $cx -Sql "SELECT pg_encoding_to_char(encoding) || ', ' || datcollate FROM pg_database WHERE datname = current_database()"
    Anotar "  Base $Base creada vacia ($cod)."

    # 3. Linea base.
    Anotar '  Linea base:'
    Anotar '    learnity_esquema.sql'
    Ejecutar-Archivo '..\learnity_esquema.sql' '000' @('-1')
    Anotar '    015_sesiones_y_recuperacion.sql'
    Ejecutar-Archivo '..\015_sesiones_y_recuperacion.sql' '015'
    Anotar '    016_limpieza_pdf.sql'
    Ejecutar-Archivo '..\016_limpieza_pdf.sql' '016'
    Anotar '    linea_base_permisos.sql'
    Ejecutar-Archivo '..\linea_base_permisos.sql' 'permisos'
    $hBase = Tomar-Huella 'linea-base'
    $refBase = Leer-Referencia 'huella-linea-base.txt'
    Anotar ''
    Anotar '--- Huellas (TOTAL: filas|md5) ---'
    Anotar "  Linea base            $($hBase['TOTAL'])  (referencia H0 del 19-10-2026: $($refBase['TOTAL']))"
    $cmp = Comparar-Huellas $refBase $hBase
    Anotar "  Linea base = H0: $cmp"
    if (-not (Huella-Aceptable $cmp)) { $exito = $false }

    if ($SoloLineaBase) {
        Anotar ''
        Anotar "--- Estado final: linea base, sin migraciones ni 019b (-SoloLineaBase). Siguiente paso posible: probar-migraciones.ps1 -Base $Base ---"
    } else {
        # 4. Migraciones.
        Anotar ''
        Anotar '--- Migraciones ---'
        foreach ($m in $omitidas) { Anotar "  retenida $($m.Up) (RETENIDAS.txt; sin -IncluirRetenidas)" }
        foreach ($m in $aAplicar) {
            $script:resumen.Add("  up   $($m.Up)")    # Aplicar-Una ya lo escribe en pantalla
            if (-not (Aplicar-Una -Cx $cx -Migracion $m)) { throw "Fallo el up de la $($m.Version)." }
        }
        $aplicadas = @(Obtener-Aplicadas -Cx $cx | ForEach-Object { $_.Version })
        $hMig = Tomar-Huella 'migrada'
        if (@($aplicadas | Where-Object { $_ -gt '026' }).Count -gt 0) {
            Anotar '  Huella migrada: SIN REFERENCIA (hay migraciones posteriores a la 026; actualiza verificacion\referencias\)'
        } else {
            $nombreRef = if ($aplicadas -contains '023') { 'huella-migrada-con-023.txt' } else { 'huella-migrada.txt' }
            $etiqueta = if ($aplicadas -contains '023') { 'H1' } else { 'H4' }
            $refMig = Leer-Referencia $nombreRef
            Anotar "  Migrada, sin 019b     $($hMig['TOTAL'])  (referencia $etiqueta del 19-10-2026: $($refMig['TOTAL']))"
            $cmp = Comparar-Huellas $refMig $hMig
            Anotar "  Migrada = ${etiqueta}: $cmp"
            if (-not (Huella-Aceptable $cmp)) { $exito = $false }
        }
        Anotar "  schema_migraciones: $($aplicadas -join ', ')"

        # 5. 019b, solo en _test.
        Anotar ''
        if ($esTest) {
            Anotar '--- 019b: pruebas\privilegios_pruebas.sql ---'
            Ejecutar-Archivo '..\pruebas\privilegios_pruebas.sql' '019b'
            Anotar '  aplicada'
        } else {
            Anotar "--- 019b: no se aplica ($Base no es _test) ---"
        }

        # 6. Verificacion.
        $resultados = [ordered]@{}
        $resultados['esquema'] = Ejecutar-Verificacion '..\verificacion\esquema_final.sql' 'Esquema final (seccion | elemento | esperado | obtenido | resultado)'
        $resultados['matriz'] = Ejecutar-Verificacion '..\verificacion\matriz_privilegios.sql' 'Matriz de privilegios (rol | objeto | esperado | concedido | resultado)'
        if ($esTest) {
            $resultados['funcionales'] = Ejecutar-Verificacion '..\verificacion\pruebas_funcionales.sql' 'Pruebas funcionales (n | prueba | esperado | obtenido | resultado)'
            $resultados['catalogo'] = Ejecutar-Verificacion '..\verificacion\comparar_catalogo.sql' 'Catalogo: consultas actuales frente a vistas (comparacion | actual | vista | diferencias | resultado)'
        }
        $esperados = @{ esquema = 'ESQUEMA OK'; matriz = 'MATRIZ OK'; funcionales = 'PRUEBAS OK'; catalogo = 'CATALOGO IGUAL' }
        Anotar ''
        Anotar '--- Resultado ---'
        foreach ($k in $resultados.Keys) {
            Anotar "  ${k}: $($resultados[$k])"
            if ($resultados[$k] -ne $esperados[$k]) { $exito = $false }
        }
        Anotar "--- Estado final de ${Base}: $($aplicadas -join ', ')$(if ($esTest) { ' + 019b' }) ---"
    }
} catch {
    $exito = $false
    Anotar ''
    Anotar "ERROR: $($_.Exception.Message)"
    $estado = ''
    try { $estado = (@(Obtener-Aplicadas -Cx $cx) | ForEach-Object { $_.Version }) -join ', ' } catch { }
    if (-not $estado) { $estado = '(sin schema_migraciones o sin base)' }
    Anotar "Estado de ${Base} al fallar: $estado. Se puede repetir el script: vuelve a empezar desde cero."
} finally {
    $resumen | Set-Content -LiteralPath (Join-Path $SalidaDir 'resumen.txt') -Encoding UTF8
    Write-Host ''
    Write-Host "Salidas completas en: $SalidaDir"
    Cerrar-Conexion
    Pop-Location
}
if (-not $exito) { exit 1 }
