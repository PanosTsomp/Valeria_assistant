#!/usr/bin/env bash
set -e

# Prompt user to choose which unit test to run
echo "Select unit test to run:" \
     "1) whisperUnitTest" \
     "2) llamaUnitTest"
read -rp "Enter 1 or 2: " choice

# Build tests if needed
if [[ ! -f build/whisperUnitTest ]]; then
  echo "Building unit tests..."
  ./run_build.sh
fi

case "$choice" in
  1)
    TEST_BIN=build/whisperUnitTest
    ;;
  2)
    TEST_BIN=build/llamaUnitTest
    ;;
  *)
    echo "Invalid choice." >&2
    exit 1
    ;;
esac

echo "Running $TEST_BIN..."
"$TEST_BIN"