param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._-]*$')][string]$SshAlias,
  [string]$Commit = 'HEAD'
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$dirty = & git -C $repo status --porcelain
if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Commit and review the complete tree before deploying.' }
$revision = (& git -C $repo rev-parse --verify "$Commit^{commit}").Trim()
if ($LASTEXITCODE -ne 0 -or $revision -notmatch '^[0-9a-f]{40}$') { throw 'Choose a Git commit.' }
$temp = Join-Path ([IO.Path]::GetTempPath()) ('nexus-dev-' + [Guid]::NewGuid().ToString('N') + '.tar')
$remote = '/tmp/nexus-dev-' + $revision + '.tar'
try {
  & git -C $repo archive --format=tar "--output=$temp" $revision nexus/src nexus/ops nexus/tools/database.js
  if ($LASTEXITCODE -ne 0) { throw 'Git archive failed.' }
  & scp -- $temp "${SshAlias}:$remote"
  if ($LASTEXITCODE -ne 0) { throw 'Runtime upload failed.' }
  # Credentials stay in the SSH agent/on the origin. No local auth files enter
  # the archive. The fixed dev installer cannot select a production service.
  & ssh $SshAlias "tar -xOf '$remote' nexus/ops/deploy-dev.sh | sudo -n sh -s -- '$remote' '$revision'"
  if ($LASTEXITCODE -ne 0) { throw 'Development deployment failed.' }
} finally {
  if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp }
}
