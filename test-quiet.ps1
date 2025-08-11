# PowerShell script to run tests without EBUSY warnings
$ErrorActionPreference = "Continue"

# Run vitest and filter out EBUSY warnings
& npm test 2>&1 | Where-Object {
    $_ -notmatch "Unable to remove temporary directory" -and
    $_ -notmatch "EBUSY: resource busy or locked"
}

# Exit with the same code as npm test
exit $LASTEXITCODE