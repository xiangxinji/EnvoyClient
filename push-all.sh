#!/usr/bin/env bash
set -euo pipefail

echo "=== git push (main repo) ==="
git push

echo ""
echo "=== pushing submodules ==="
git submodule foreach 'echo "--- \$path ---" && git push'
