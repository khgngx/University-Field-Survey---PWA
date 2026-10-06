#!/usr/bin/env bash
# Builds a debug APK: web build -> cap sync -> gradle assembleDebug.
# Android Gradle Plugin 8.13 / Gradle 8.14 need JDK 21; newer JDKs (e.g. 25) fail, so pick 21 explicitly.
set -euo pipefail
cd "$(dirname "$0")/.."

java_major() { "$1/bin/java" -version 2>&1 | sed -n '1s/.*version "\([0-9]*\).*/\1/p'; }

find_jdk21() {
  local candidate
  for candidate in \
    "${JAVA_HOME:-}" \
    "$(brew --prefix openjdk@21 2>/dev/null)/libexec/openjdk.jdk/Contents/Home" \
    "$(/usr/libexec/java_home -v 21 2>/dev/null || true)"; do
    if [ -n "$candidate" ] && [ -x "$candidate/bin/java" ] && [ "$(java_major "$candidate")" = "21" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

JAVA_HOME="$(find_jdk21)" || { echo "error: JDK 21 not found. Install it with: brew install openjdk@21" >&2; exit 1; }
export JAVA_HOME
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
[ -d "$ANDROID_HOME/platforms" ] || { echo "error: Android SDK not found at $ANDROID_HOME (set ANDROID_HOME)" >&2; exit 1; }

echo "JAVA_HOME=$JAVA_HOME"
echo "ANDROID_HOME=$ANDROID_HOME"

npm run build
npx cap sync android
(cd android && ./gradlew assembleDebug)

APK="android/app/build/outputs/apk/debug/app-debug.apk"
[ -f "$APK" ] || { echo "error: build finished but $APK is missing" >&2; exit 1; }
echo "APK ready: $APK ($(du -h "$APK" | cut -f1))"
