$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$Root = Split-Path -Parent $PSScriptRoot
$HomeDir = Join-Path $env:LOCALAPPDATA 'MoaInvest'
$Logs = Join-Path $HomeDir 'logs'
New-Item -ItemType Directory -Force -Path $Logs | Out-Null
$LogPath = Join-Path $Logs ('start-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
Start-Transcript -Path $LogPath | Out-Null

function Test-Python([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    & $Path -c 'import sys; raise SystemExit(0 if (3,12) <= sys.version_info < (3,15) else 1)' 2>$null
    return $LASTEXITCODE -eq 0
}

try {
    Set-Location -LiteralPath $Root
    Write-Host ''
    Write-Host '모아를 준비하고 있습니다. 처음 실행할 때만 몇 분이 걸립니다.' -ForegroundColor Green
    if (-not [Environment]::Is64BitOperatingSystem) { throw '64비트 Windows 10/11에서 실행해 주세요.' }
    if (-not (Test-Path -LiteralPath (Join-Path $Root 'desktop\web\index.html'))) {
        throw '화면 파일이 없습니다. 최신 ZIP을 다시 내려받아 압축을 모두 풀어 주세요.'
    }
    Write-Host '[1/3] 실행 환경 확인'
    $Runtime = Join-Path $HomeDir 'runtime\python'
    $Candidates = @(
        (Join-Path $Runtime 'python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python314\python.exe')
    )
    foreach ($Registry in @('HKCU:', 'HKLM:')) {
        foreach ($Version in @('3.13', '3.12', '3.14')) {
            $Key = $Registry + '\Software\Python\PythonCore\' + $Version + '\InstallPath'
            if (Test-Path $Key) {
                $InstalledPath = (Get-Item $Key).GetValue('')
                if ($InstalledPath) { $Candidates += Join-Path $InstalledPath 'python.exe' }
            }
        }
    }
    $Command = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($Command -and $Command.Source -notlike '*\Microsoft\WindowsApps\*') { $Candidates += $Command.Source }
    $Python = $null
    foreach ($Candidate in $Candidates) {
        if (Test-Python $Candidate) { $Python = $Candidate; break }
    }
    if (-not $Python) {
        Write-Host 'Python을 공식 배포처에서 내려받고 있습니다.'
        New-Item -ItemType Directory -Force -Path (Join-Path $HomeDir 'runtime') | Out-Null
        $Installer = Join-Path $HomeDir 'runtime\python-3.13.12-amd64.exe'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -UseBasicParsing -Uri 'https://www.python.org/ftp/python/3.13.12/python-3.13.12-amd64.exe' -OutFile $Installer
        # Published SHA256 from Microsoft's winget-pkgs Python.Python.3.13/3.13.12 manifest.
        $Expected = '96159FCB523AE404B707186A75B4104EE23851E476A5E838E14584CF1E03F981'
        if ((Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash -ne $Expected) {
            Remove-Item -LiteralPath $Installer
            throw 'Python 설치 파일의 검증에 실패했습니다. 실행하지 않았습니다.'
        }
        if ((Get-AuthenticodeSignature -LiteralPath $Installer).Status -ne 'Valid') {
            throw 'Python 설치 파일의 서명을 확인할 수 없습니다. 설치하지 않았습니다.'
        }
        $InstallArgs = @('/quiet', '/norestart', 'InstallAllUsers=0', 'Include_launcher=0', 'Include_test=0', 'Include_pip=1', 'PrependPath=0', ('TargetDir="{0}"' -f $Runtime))
        $Process = Start-Process -FilePath $Installer -ArgumentList $InstallArgs -Wait -PassThru
        if ($Process.ExitCode -notin @(0,3010)) { throw ('Python 설치 실패: ' + $Process.ExitCode) }
        $Python = Join-Path $Runtime 'python.exe'
        if (-not (Test-Python $Python)) { throw 'Python을 준비하지 못했습니다. 이 창의 메시지를 알려주세요.' }
    }
    Write-Host '[2/3] 모아 구성요소 준비'
    $Environment = Join-Path $HomeDir 'venv'
    $AppPython = Join-Path $Environment 'Scripts\python.exe'
    if (-not (Test-Python $AppPython)) {
        & $Python -m venv $Environment
        if ($LASTEXITCODE -ne 0) { throw '전용 실행 환경 생성에 실패했습니다.' }
    }
    $Requirements = Join-Path $Root 'requirements.txt'
    $Hash = (Get-FileHash -LiteralPath $Requirements -Algorithm SHA256).Hash
    $Marker = Join-Path $Environment 'moa-requirements.sha256'
    if (-not (Test-Path $Marker) -or (Get-Content -Raw -LiteralPath $Marker).Trim() -ne $Hash) {
        & $AppPython -m pip install --disable-pip-version-check --only-binary=:all: -r $Requirements
        if ($LASTEXITCODE -ne 0) { throw '구성요소 다운로드에 실패했습니다. 인터넷 연결과 이 창의 메시지를 확인해 주세요.' }
        Set-Content -LiteralPath $Marker -Value $Hash -Encoding ASCII
    }
    Write-Host '[3/3] 브라우저 열기' -ForegroundColor Green
    $env:INVEST_DATA_DIR = Join-Path $HomeDir 'data'
    $env:INVEST_WEB_DIR = Join-Path $Root 'desktop\web'
    $env:PYTHONUTF8 = '1'
    & $AppPython (Join-Path $Root 'scripts\desktop.py')
    if ($LASTEXITCODE -ne 0) { throw '모아를 시작하지 못했습니다. 위 오류 메시지를 알려주세요.' }
} catch {
    Write-Host ''
    Write-Host ('시작하지 못했습니다: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host ('기록 파일: ' + $LogPath)
    Stop-Transcript | Out-Null
    exit 1
}
Stop-Transcript | Out-Null
