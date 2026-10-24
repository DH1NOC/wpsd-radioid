#!/bin/sh
# Baut das Release-ZIP dist/wpsd-radioid-<version>.zip mit allen Dateien der Erweiterung.
set -e
cd "$(dirname "$0")"
VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json)
NAME="wpsd-radioid-$VERSION"
rm -rf "dist/$NAME" "dist/$NAME.zip"
mkdir -p "dist/$NAME"
cp manifest.json background.js detect.js content.js content.css popup.html popup.js bugreport.js \
   README.md LICENSE CHANGELOG.md "dist/$NAME/"
(cd dist && zip -qr "$NAME.zip" "$NAME")
rm -rf "dist/$NAME"
echo "dist/$NAME.zip"
