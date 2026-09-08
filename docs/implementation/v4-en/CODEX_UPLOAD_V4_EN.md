# Local Codex task — publish GrideX v4 through a draft PR

**Documentation publication only. Do not execute the deployment runbooks.**

Source: the `GrideX_Implementation_v4` handoff directory outside the Git repository and Docker build context.
Target repository: `antouanbg/gridex-openremote-backend`.
Target directory: `docs/implementation/v4/`.
Suggested branch: `docs/implementation-v4-site-router-vpn`, or another unique unused name.
Base: current `origin/main`.

## Permitted outcome

Publish only the verified documentation, templates, diagram, and read-only verification tool through a new commit, new branch, and draft PR. Do not merge or enable auto-merge.

This task does not authorize deployment, installation, restart, or changes to Windows, routers, WireGuard, Docker, Edge, or BESS. Do not generate/read private keys or replace placeholders with actual values. Do not upload v1/v2/v3 archives, patches, old generated images, operator copies, or the complete ZIP.

A public branch and draft PR are public. Never publish real network addresses, site locations, credentials, device inventory, captures, or logs.

## 1. Repository and access

Read every applicable `AGENTS.md`. Check the current directory, origin, branch, and unfinished work. Origin must match the target repository. Never print embedded credentials from the remote URL or change origin, visibility, or permissions.

Verify Git and GitHub CLI authentication in the same Windows/WSL environment. If login is absent, the operator runs:

```text
gh auth login --hostname github.com --web
```

Never display a token or use `--show-token`/`gh auth token`. Stop and report an access denial; do not bypass permissions.

Do not use `reset --hard`, `clean -fd`, automatic stash, or force push. Fetch current `origin/main` and prefer a clean, separate worktree. Record the base SHA. Check existing branches and PRs to avoid duplication or overwriting another person's work.

## 2. Source-package validation

Read the package README, changelog, this task, and the complete source of `tools/verify_package.py`. Confirm that the tool performs local read-only checksum, structure, and reporting operations only, without network or system changes.

Run from the source directory:

```text
python tools/verify_package.py
```

Use the available Python command without installing dependencies; the tool uses only the standard library. Require successful manifest and file-set validation. Checksums prove integrity against the supplied manifest, not digitally signed provenance. Stop before commit if a file is missing, unexpected, modified, symlinked, or referenced through an unsafe path.

Inspect the PNG visually. It must show placeholders, HAProxy, two separate PostgreSQL databases, WireGuard on Windows and the routers, no VPN on ROCK Pi, and no public MQTT. Do not replace it with an older conversation image.

## 3. Files to copy

Copy exactly the files listed in `SHA256SUMS.txt`, plus `SHA256SUMS.txt` itself, into `docs/implementation/v4/`, preserving names, directories, and bytes.

Do not execute templates or runbooks. When a different v4 directory already exists, compare it and stop on ambiguity rather than overwriting it automatically.

Permitted additions outside the package directory are:

- a short index/link update in `docs/implementation/README.md`;
- a short v4 link in the root `README.md`, preserving its bilingual format;
- reviewed, missing `.gitignore` rules;
- a narrowly scoped `.gitattributes` rule required for byte preservation.

The index must explain that v4 supersedes only legacy network decisions for WireGuard on ROCK Pi, direct public ESP MQTT, and old AllowedIPs. It does not close other control or security blockers. Retained old versions are historical.

On Windows, inspect `.gitattributes` and `core.autocrlf`. If necessary, add only:

```gitattributes
docs/implementation/v4/** -text
```

Do not modify global Git configuration, code, Compose, or workflows. Do not move `.example` files into active configuration locations or update another repository.

## 4. Confidentiality and accuracy

Review every new or changed text, image, JSON document, metadata field, diff, commit message, and PR description for:

- real public/LAN/VPN/OT addresses, prefixes, or deployment DNS names;
- private keys, tokens, passwords, QR configurations, DPAPI files, or working configurations;
- real public keys, fingerprints, peer/site/device inventory;
- customer data, personal local paths, logs, captures, or operational evidence.

Public official documentation and source-repository URLs are allowed unless they contain credentials. Preserve intentional placeholders. Never add actual values from chat or the local machine.

Use an available local secret scanner plus a content review. Do not upload files to an external scanner. If uncertain, report only the file, line/field, and category—not the sensitive value—and stop before push.

Validate relative Markdown links and JSON. Run `verify_package.py` again inside the target v4 directory. Historical source-code findings remain historical, and runtime tests remain `NOT_RUN` without real evidence. Documentation validation is not runtime `PASS`.

Inspect `.github/workflows` before push. If the PR could trigger a deployment or privileged runtime workflow, stop and report it without changing the workflow. Do not open public issues containing configuration details.

## 5. Commit, push, and draft PR

Stage only explicit permitted paths; do not use `git add .` or `git add -A`. Review the staged diff, binary files, and `git diff --cached --check`. Compare every commit against the recorded base SHA and ensure no unrelated work or secrets are included.

Use commit message:

```text
docs: add v4 site-router WireGuard deployment package
```

Push only the new branch. Create a draft PR with explicit repository, base, head, title, and body file:

```text
docs: GrideX v4 site-router VPN implementation plan
```

The PR body must describe:

- the added package;
- native Windows WireGuard and per-site router peers;
- no VPN on ROCK Pi/ESP32 and Modbus/MQTTS through the routed tunnel;
- unique site prefixes, no SNAT/OT route/site transit;
- VPN-only TCP 8883 with no public fallback;
- persistent machine keys with trusted enrollment and revocation;
- historical blockers, new router risks, and 95 `NOT_RUN` tests;
- exact documentation validations performed;
- no deployment, secrets, or hardware tests.

Do not merge or enable auto-merge. If push or PR creation fails, preserve the local work and report the exact failed stage.

## 6. Final report

Report the repository, base SHA, branch, new commit SHA, changed files, validation results, push result, and the actual PR URL. Report workflow checks as pending, successful, failed, or absent—never assume their state.

State explicitly that `main` was not changed, no deployment occurred, and placeholders were not replaced with real addresses or keys. Locally prepared files are not the same as a successful push.

CLI references: S6–S7 in [SOURCES_EN.md](SOURCES_EN.md).
