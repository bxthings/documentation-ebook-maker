#!/usr/bin/env bash
# Validate XHTML well-formedness of all chapter files in an EPUB.
# Usage: ./scripts/validate-epub.sh [file.epub]
# Defaults to the most recently modified *.epub in the current directory.

set -euo pipefail

epub="${1:-}"
if [ -z "$epub" ]; then
  epub=$(ls -t ./*.epub 2>/dev/null | head -1)
fi

if [ -z "$epub" ]; then
  echo "No EPUB file found. Pass a path or run from the project root." >&2
  exit 1
fi

echo "Validating $epub..."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

unzip -q "$epub" -d "$tmp"

errors=0
while IFS= read -r -d '' f; do
  if ! xmllint --noout "$f" 2>/tmp/xmllint-err; then
    echo "FAIL: $f"
    cat /tmp/xmllint-err
    errors=$((errors + 1))
  fi
done < <(find "$tmp/OEBPS" -name '*.xhtml' -print0 | sort -z)

if [ "$errors" -eq 0 ]; then
  echo "All XHTML files are well-formed."
else
  echo "$errors file(s) failed validation." >&2
  exit 1
fi
