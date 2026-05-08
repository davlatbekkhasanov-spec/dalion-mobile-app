@echo off
REM One-shot helper to commit + push the production tracking-map fix.
REM Run from anywhere; it cd's to the repo root.

setlocal enableextensions
set REPO=%~dp0..
pushd "%REPO%" || (echo Cannot enter repo & exit /b 1)

echo === Repo: %CD% ===
git status
if errorlevel 1 goto :err

echo.
echo === Staging track.html and helper script ===
git add track.html scripts\commit-track-fix.cmd
if errorlevel 1 goto :err

echo.
echo === Committing ===
git commit -m "fix production tracking map provider fallback and render reliability"
if errorlevel 1 (
  echo Nothing to commit or commit failed. Check status above.
  goto :end
)

echo.
echo === Pushing to main ===
git push origin HEAD:main
if errorlevel 1 goto :err

echo.
echo === Done. Latest commit: ===
git log -1 --oneline
goto :end

:err
echo.
echo ERROR: a step above failed. See output.
exit /b 1

:end
popd
endlocal
