@echo off
setlocal

cd /d "%~dp0"

echo Checking for project updates...

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed, so automatic updates are skipped.
  echo Install Git for Windows to enable automatic updates:
  echo https://git-scm.com/download/win
  echo.
  goto start_app
)

for /f "delims=" %%b in ('git branch --show-current 2^>nul') do set "CURRENT_BRANCH=%%b"
if not "%CURRENT_BRANCH%"=="main" (
  echo Current branch is "%CURRENT_BRANCH%"; automatic update only runs on main.
  echo.
  goto start_app
)

git diff --quiet --exit-code
if errorlevel 1 (
  echo Local tracked files have uncommitted changes; automatic update is skipped.
  echo Commit or stash your changes if you want start.bat to update from GitHub.
  echo.
  goto start_app
)

git diff --cached --quiet --exit-code
if errorlevel 1 (
  echo Local tracked files have staged changes; automatic update is skipped.
  echo Commit or stash your changes if you want start.bat to update from GitHub.
  echo.
  goto start_app
)

git fetch origin main
if errorlevel 1 (
  echo Could not fetch the latest main from GitHub; continuing with the local version.
  echo.
  goto start_app
)

git pull --ff-only origin main
if errorlevel 1 (
  echo Could not fast-forward to the latest main; continuing with the local version.
  echo.
  goto start_app
)

echo Project is up to date.
echo.

:start_app
npm run dev
