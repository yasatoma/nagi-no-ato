$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$repositoryName = 'nagi-no-ato'
$safeRepository = $PSScriptRoot.Replace('\', '/')

function Invoke-CheckedGit {
    param([string[]]$GitArguments)
    & git -c "safe.directory=$safeRepository" @GitArguments
    if ($LASTEXITCODE -ne 0) { throw 'Git operation failed. No further upload was attempted.' }
}

& gh auth status --hostname github.com
if ($LASTEXITCODE -ne 0) {
    & gh auth login --hostname github.com --git-protocol https --web
    if ($LASTEXITCODE -ne 0) { throw 'GitHub sign-in was not completed.' }
}
$ownerName = & gh api user --jq .login
if ($LASTEXITCODE -ne 0 -or -not $ownerName) { throw 'Cannot determine the signed-in account.' }
$repositoryFullName = "$ownerName/$repositoryName"

# Do not overwrite or reuse a repository which happens to have the same name.
$existingRepositories = & gh repo list $ownerName --limit 1000 --json name --jq '.[].name'
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect existing repositories.' }
if ($existingRepositories -contains $repositoryName) { throw "$repositoryFullName already exists. Nothing was uploaded; ask Codex to inspect it." }
$existingRemotes = & git -c "safe.directory=$safeRepository" remote
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect local remotes.' }
if ($existingRemotes -contains 'origin') { throw 'An origin already exists. Nothing was uploaded.' }

Invoke-CheckedGit -GitArguments @('add', '--', '.gitignore', 'README.md', 'Start-Game.cmd', 'Register-PrivateRepository.ps1', 'assets', 'docs', 'index.html', 'package.json', 'package-lock.json', 'src', 'tests', 'tools')
& git -c "safe.directory=$safeRepository" diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
    Invoke-CheckedGit -GitArguments @('-c', 'user.name=Codex', '-c', 'user.email=codex@local.invalid', 'commit', '-m', 'Complete original mystery visual novel')
} elseif ($LASTEXITCODE -ne 0) { throw 'Cannot inspect staged changes.' }
Invoke-CheckedGit -GitArguments @('branch', '-M', 'main')

& gh repo create $repositoryFullName --private --description 'Original Japanese mystery visual novel: After the Quiet, a Voice Remains'
if ($LASTEXITCODE -ne 0) { throw 'Private repository creation failed. No push was attempted.' }
$privateState = & gh repo view $repositoryFullName --json isPrivate --jq .isPrivate
if ($LASTEXITCODE -ne 0 -or $privateState -ne 'true') { throw 'Private visibility could not be verified. No push was attempted.' }

& gh auth setup-git --hostname github.com
if ($LASTEXITCODE -ne 0) { throw 'Git authentication setup failed. The empty private repository exists; no push was attempted.' }
Invoke-CheckedGit -GitArguments @('remote', 'add', 'origin', "https://github.com/$repositoryFullName.git")
Invoke-CheckedGit -GitArguments @('push', '-u', 'origin', 'main')
& gh repo view $repositoryFullName --json url,isPrivate,defaultBranchRef
if ($LASTEXITCODE -ne 0) { throw 'Upload finished, but final verification failed.' }
Write-Host "Completed: https://github.com/$repositoryFullName (Private)"
