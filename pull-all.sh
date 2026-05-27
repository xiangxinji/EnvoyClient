#!/usr/bin/env bash
set -euo pipefail

echo "=== git fetch ==="
git fetch

echo ""
echo "=== git pull (main repo) ==="
git pull

echo ""
echo "=== pulling submodules ==="
git submodule update --remote --merge
