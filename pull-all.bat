@echo off
echo === git fetch ===
git fetch

echo.
echo === git pull (main repo) ===
git pull

echo.
echo === pulling submodules ===
git submodule update --remote --merge
