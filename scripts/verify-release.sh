#!/usr/bin/env bash
# Download a published release's installers and verify them against the
# release's SHA256SUMS.txt. Usage: scripts/verify-release.sh [tag]
# Requires: curl, sha256sum, python3 (or python).
set -euo pipefail

REPO="sourcexex/uartis"
TAG="${1:-}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PYTHON=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys' >/dev/null 2>&1; then
    PYTHON="$candidate"
    break
  fi
done
if [[ -z "$PYTHON" ]]; then
  echo "error: a working python3/python was not found" >&2
  exit 1
fi

if [[ -z "$TAG" ]]; then
  TAG="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | "$PYTHON" -c 'import json,sys; print(json.load(sys.stdin)["tag_name"])')"
fi

echo "Fetching release ${TAG}..."
curl -fsSL "https://api.github.com/repos/${REPO}/releases/tags/${TAG}" -o "${TMP_DIR}/release.json"

"$PYTHON" - "${TMP_DIR}/release.json" > "${TMP_DIR}/urls.txt" <<'PY'
import json, sys
release = json.load(open(sys.argv[1], encoding="utf-8"))
names = []
for asset in release.get("assets", []):
    name = asset["name"]
    if name == "SHA256SUMS.txt" or name.endswith((".exe", ".dmg", ".msi", ".pkg")):
        names.append(name)
        print(asset["browser_download_url"])
if not names:
    raise SystemExit("no installer/checksum assets found")
PY

while IFS= read -r url; do
  url="${url%$'\r'}"
  file="${TMP_DIR}/$(basename "$url")"
  echo "Downloading $(basename "$url")..."
  curl -fL --retry 3 --retry-delay 2 -o "$file" "$url"
done < "${TMP_DIR}/urls.txt"

if [[ ! -f "${TMP_DIR}/SHA256SUMS.txt" ]]; then
  echo "error: SHA256SUMS.txt is missing from the release" >&2
  exit 1
fi

(
  cd "$TMP_DIR"
  # SHA256SUMS.txt is produced on Windows and therefore CRLF; normalize it so
  # sha256sum's filename parsing works on every platform.
  tr -d '\r' < SHA256SUMS.txt > SHA256SUMS.verify
  sha256sum -c SHA256SUMS.verify
)
echo "Release ${TAG}: all checksums verified."
