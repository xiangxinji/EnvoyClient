@echo off
set http_proxy=http://127.0.0.1:7890
set https_proxy=http://127.0.0.1:7890
echo === proxy set to 127.0.0.1:7890 ===

echo === git push (main repo) ===
git push

echo.
echo === pushing submodules ===
git submodule foreach "echo --- $path --- && git push"

set http_proxy=
set https_proxy=
echo === proxy unset ===
