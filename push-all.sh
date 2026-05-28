#!/usr/bin/env bash
set -euo pipefail

export http_proxy=http://127.0.0.1:7890
export https_proxy=http://127.0.0.1:7890
echo "=== proxy set to 127.0.0.1:7890 ==="

cleanup() {
  unset http_proxy https_proxy
  echo "=== proxy unset ==="
}
trap cleanup EXIT

echo "=== git push (main repo) ==="
git push

echo ""
echo "=== pushing submodules ==="
git submodule foreach 'echo "--- \$path ---" && git push'
