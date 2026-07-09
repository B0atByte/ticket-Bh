@echo off
REM Run SonarQube scanner against the local self-hosted server.
REM Usage: scripts\sonar-scan.cmd <token>
REM
REM Generate <token> at http://localhost:9000/account/security (after first login).
REM Generates fresh coverage for server + client before scanning.

if "%~1"=="" (
  echo Usage: %0 ^<sonar-token^>
  echo Generate token at http://localhost:9000/account/security
  exit /b 1
)

set TOKEN=%~1
set ROOT=%~dp0..

echo [1/3] Generating server coverage (lcov.info)...
pushd "%ROOT%\server" && call npm.cmd test -- --coverage --reporter=default || (popd & exit /b 1)
popd

echo [2/3] Generating client coverage (lcov.info)...
pushd "%ROOT%\client" && call npm.cmd test -- --coverage --reporter=default || (popd & exit /b 1)
popd

echo [3/3] Running SonarScanner (Docker)...
docker run --rm ^
  --network=lms-sonar_sonar-net ^
  -e SONAR_TOKEN=%TOKEN% ^
  -v "%ROOT%:/usr/src" ^
  sonarsource/sonar-scanner-cli || exit /b 1

echo.
echo OK — open results at http://localhost:9000/dashboard?id=lms-casa
