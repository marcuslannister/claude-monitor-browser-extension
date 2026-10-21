#!/bin/sh
# Builds the Safari app that carries the extension, installs it in
# ~/Applications, and opens it so Safari registers the extension.
# Needs Xcode and an Apple Development team (a free Personal Team works):
#   SAFARI_TEAM=<team id> safari/build.sh
set -eu
: "${SAFARI_TEAM:?set SAFARI_TEAM to your Apple Development team ID}"

root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/build/safari"
src="$out/src"
name="Claude Monitor Extension"
id="dev.local.claude-monitor-extension"
proj="$out/$name/$name.xcodeproj"

# The Xcode project points at these files, so each build refreshes them in place.
# shortcut: a new top-level file in extension/ is not in the project; move
# build/safari/<name> to the Trash to convert again.
mkdir -p "$src"
rsync -a --delete --exclude 'manifest*.json' "$root/extension/" "$src/"
cp "$root/extension/manifest.safari.json" "$src/manifest.json"

if [ ! -d "$proj" ]; then
  xcrun safari-web-extension-converter "$src" --project-location "$out" --app-name "$name" \
    --bundle-identifier "$id" --macos-only --swift --no-open --no-prompt
  # The converter derives the app id from the app name; the extension id must
  # keep the app id as its prefix, or the build fails.
  perl -pi -e "s/dev\.local\.Claude-Monitor-Extension/$id/g" "$proj/project.pbxproj"
fi

xcodebuild -project "$proj" -scheme "$name" -configuration Debug -derivedDataPath "$out/DerivedData" \
  -allowProvisioningUpdates CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM="$SAFARI_TEAM" -quiet build

app="$out/DerivedData/Build/Products/Debug/$name.app"
dst="$HOME/Applications/$name.app"
mkdir -p "$HOME/Applications"
rsync -a --delete "$app/" "$dst/"
lsr=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
"$lsr" -u "$app" || true
"$lsr" -f "$dst"
open "$dst"
