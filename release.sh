#!/bin/sh
# release.sh — create a GitHub release and upload build artifacts
# Requires: gh (GitHub CLI), authenticated with repo write access
# Run from the repository root after `make build-all`

set -e

VERSION=$(head -1 version.txt)
TAG="v${VERSION}"
BUILD_DIR="./build"

# Verify build artifacts exist
if [ ! -d "$BUILD_DIR" ] || [ -z "$(ls "$BUILD_DIR" 2>/dev/null)" ]; then
    echo "error: no artifacts in $BUILD_DIR — run 'make build-all' first" >&2
    exit 1
fi

# Verify gh is available and authenticated
if ! gh auth status > /dev/null 2>&1; then
    echo "error: gh is not authenticated — run 'gh auth login' first" >&2
    exit 1
fi

# Extract changelog entry for this version
NOTES=$(awk "/^## ${VERSION}/{found=1; next} found && /^## /{exit} found{print}" CHANGELOG.md)
if [ -z "$NOTES" ]; then
    echo "warning: no changelog entry found for ${VERSION}"
    NOTES="Release ${VERSION}"
fi

# Determine if pre-release
PRERELEASE_FLAG=""
case "$VERSION" in
    *-*) PRERELEASE_FLAG="--prerelease" ;;
esac

echo "Creating release ${TAG}..."
gh release create "$TAG" \
    --title "$TAG" \
    --notes "$NOTES" \
    $PRERELEASE_FLAG

echo "Uploading artifacts..."
for f in "$BUILD_DIR"/*.dylib "$BUILD_DIR"/*.so "$BUILD_DIR"/*.dll "$BUILD_DIR"/*.sha256; do
    [ -f "$f" ] || continue
    gh release upload "$TAG" "$f"
    echo "  uploaded: $(basename "$f")"
done

echo ""
echo "Release ${TAG} published."
gh release view "$TAG" --web
