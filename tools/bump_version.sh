#!/bin/sh
# Set the version shown in the app and the offline-cache version together.
#   tools/bump_version.sh 27.10.26a
set -e
cd "$(dirname "$0")/.."
v="$1"
case "$v" in
  [0-9][0-9].[0-9][0-9].[0-9][0-9]*) ;;
  *) echo "Usage: tools/bump_version.sh DD.MM.YYx" >&2; exit 1 ;;
esac
sed -i '' "s/^BT.version = '.*';/BT.version = '$v';/" js/core.js
sed -i '' "s/^const VERSION = '.*';/const VERSION = '$v';/" sw.js
grep -n "^BT.version" js/core.js
grep -n "^const VERSION" sw.js
