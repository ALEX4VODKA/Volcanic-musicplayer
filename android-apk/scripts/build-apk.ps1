$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$localProperties = Join-Path $projectRoot "local.properties"

function Get-AndroidSdkPath {
    if ($env:ANDROID_HOME) { return $env:ANDROID_HOME }
    if ($env:ANDROID_SDK_ROOT) { return $env:ANDROID_SDK_ROOT }
    if (Test-Path $localProperties) {
        $line = Get-Content $localProperties | Where-Object { $_ -match "^sdk\.dir=" } | Select-Object -First 1
        if ($line) {
            return ($line -replace "^sdk\.dir=", "") -replace "\\\\", "\"
        }
    }
    return $null
}

$sdkPath = Get-AndroidSdkPath
if (-not $sdkPath -or -not (Test-Path $sdkPath)) {
    throw "Android SDK not found. Set ANDROID_HOME or create android-apk\local.properties from local.properties.example."
}

$gradleCommand = Get-Command gradle -ErrorAction SilentlyContinue
$wrapper = Join-Path $projectRoot "gradlew.bat"

Push-Location $projectRoot
try {
    if (Test-Path $wrapper) {
        & $wrapper assembleDebug
    } elseif ($gradleCommand) {
        & $gradleCommand.Source assembleDebug
    } else {
        throw "Gradle not found. Install Gradle 8.x or add a Gradle wrapper inside android-apk."
    }
} finally {
    Pop-Location
}
