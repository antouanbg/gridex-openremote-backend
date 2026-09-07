#!/usr/bin/env python3
"""Read-only checks for the GrideX v4 documentation handoff.

No network calls, installation, configuration changes or dependency imports.
Checksums check integrity, not signed provenance. Secret checks are heuristic.
Images require an independent visual review.
"""
from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
from pathlib import Path, PurePosixPath
import re
import sys
from urllib.parse import unquote, urlsplit

TEXT_SUFFIXES = {".md", ".json", ".example", ".py", ".txt"}
OFFICIAL_URL_HOSTS = {
    "git.zx2c4.com", "www.wireguard.com", "docs.docker.com",
    "cli.github.com", "letsencrypt.org", "learn.microsoft.com",
    "docs.github.com", "docs.openremote.io",
}
IPV4 = re.compile(r"(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?:/\d{1,2})?(?![\w.])")
IPV6_CANDIDATE = re.compile(r"(?<![\w:])[0-9a-fA-F]*:[0-9a-fA-F:]+(?:/\d{1,3})?(?![\w:])")
KEY_LITERAL = re.compile(r"(?m)^\s*(?:PrivateKey|PresharedKey)\s*=\s*(.*?)\s*$")
BASE64_KEY = re.compile(r"(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{43}=(?![A-Za-z0-9+/=])")
MARKDOWN_LINK = re.compile(r"!?\[[^\]]*\]\(([^)\s]+)\)")
URL = re.compile(r"""https?://[^\s<>`)\]"']+""")


def check(root: Path) -> dict:
    issues: list[dict[str, str]] = []

    def fail(path: str, category: str) -> None:
        # Never echo matched sensitive values.
        issues.append({"file": path, "category": category})

    if root.is_symlink():
        return {"status": "FAIL", "issues": [{"file": ".", "category": "symlink_root"}]}
    root = root.resolve()
    manifest_path = root / "SHA256SUMS.txt"
    if not manifest_path.is_file() or manifest_path.is_symlink():
        return {"status": "FAIL", "issues": [{"file": "SHA256SUMS.txt", "category": "missing_or_unsafe_manifest"}]}

    expected: dict[str, str] = {}
    try:
        manifest_text = manifest_path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return {"status": "FAIL", "issues": [{"file": "SHA256SUMS.txt", "category": "unreadable_manifest"}]}
    for line in manifest_text.splitlines():
        if not line.strip():
            continue
        parts = line.split("  ", 1)
        if len(parts) != 2 or not re.fullmatch(r"[0-9a-f]{64}", parts[0]):
            fail("SHA256SUMS.txt", "malformed_line")
            continue
        digest, rel = parts
        q = PurePosixPath(rel)
        if q.is_absolute() or ".." in q.parts or "\\" in rel or ":" in rel or str(q) != rel:
            fail("SHA256SUMS.txt", "unsafe_path")
            continue
        if rel == "SHA256SUMS.txt" or rel in expected:
            fail("SHA256SUMS.txt", "self_reference_or_duplicate")
            continue
        expected[rel] = digest

    actual: set[str] = set()
    for p in root.rglob("*"):
        rel = p.relative_to(root).as_posix()
        if p.is_symlink():
            fail(rel, "symlink")
        elif p.is_file():
            actual.add(rel)
    for missing in sorted(set(expected) - actual):
        fail(missing, "missing_file")
    for extra in sorted(actual - set(expected) - {"SHA256SUMS.txt"}):
        fail(extra, "unexpected_file")

    text_count = 0
    image_count = 0
    for rel, digest in expected.items():
        p = root / rel
        if not p.is_file() or p.is_symlink():
            continue
        data = p.read_bytes()
        if hashlib.sha256(data).hexdigest() != digest:
            fail(rel, "checksum_mismatch")
        if p.suffix == ".png":
            image_count += 1
            if not data.startswith(b"\x89PNG\r\n\x1a\n"):
                fail(rel, "invalid_png_header")
            continue
        if p.suffix not in TEXT_SUFFIXES:
            fail(rel, "unexpected_file_type")
            continue
        text_count += 1
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            fail(rel, "invalid_utf8")
            continue

        for candidate in IPV4.findall(text) + IPV6_CANDIDATE.findall(text):
            try:
                ipaddress.ip_interface(candidate)
            except ValueError:
                continue
            fail(rel, "ip_literal_detected")
            break

        for candidate in KEY_LITERAL.findall(text):
            if not re.fullmatch(r"<[A-Z0-9_]+>", candidate):
                fail(rel, "non_placeholder_private_key")
                break
        if BASE64_KEY.search(text):
            fail(rel, "possible_wireguard_key")
        # Construct markers to avoid matching this verifier's own source.
        for marker in ("-----BEGIN " + "PRIVATE KEY-----", "-----BEGIN " + "OPENSSH PRIVATE KEY-----"):
            if marker in text:
                fail(rel, "private_key_marker")
        if re.search(r"(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}", text):
            fail(rel, "possible_github_token")
        for address in URL.findall(text):
            parsed = urlsplit(address)
            if parsed.username or parsed.password:
                fail(rel, "credentials_in_url")
            if parsed.hostname not in OFFICIAL_URL_HOSTS:
                fail(rel, "unreviewed_url_host")

        if p.suffix == ".json" or p.name.endswith(".json.example"):
            try:
                json.loads(text)
            except json.JSONDecodeError:
                fail(rel, "invalid_json")
        if p.suffix == ".md":
            for target in MARKDOWN_LINK.findall(text):
                if target.startswith(("https://", "http://", "#", "mailto:")):
                    continue
                target = unquote(target.split("#", 1)[0])
                if not target:
                    continue
                resolved = (p.parent / target).resolve()
                try:
                    resolved.relative_to(root)
                except ValueError:
                    fail(rel, "markdown_link_outside_package")
                    continue
                if not resolved.is_file():
                    fail(rel, "missing_local_markdown_target")

    test_file = root / "GrideX_Acceptance_Tests_BG_v4.md"
    test_count = 0
    if test_file.is_file():
        tests = [line for line in test_file.read_text(encoding="utf-8").splitlines()
                 if re.match(r"\| T\d{2} \|", line)]
        test_count = len(tests)
        ids = [line.split("|")[1].strip() for line in tests]
        if ids != [f"T{i:02d}" for i in range(1, 96)]:
            fail(test_file.name, "test_ids_not_exact_T01_to_T95")
        if any(line.split("|")[-2].strip() != "NOT_RUN" for line in tests):
            fail(test_file.name, "runtime_status_changed_in_handoff")
    else:
        fail("GrideX_Acceptance_Tests_BG_v4.md", "missing_acceptance_plan")

    return {
        "status": "PASS" if not issues else "FAIL",
        "manifest_files": len(expected),
        "package_files_including_manifest": len(actual),
        "utf8_text_files_checked": text_count,
        "png_files_header_checked": image_count,
        "runtime_tests": test_count,
        "runtime_test_status": "NOT_RUN",
        "issues": issues,
        "limitations": [
            "No network, router, VPN, Docker or hardware tests.",
            "No exhaustive secret scan; inspect content and images manually.",
            "Checksums provide integrity against this manifest, not authenticity.",
            "Source findings inherited from v3 were not re-audited."
        ]
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    try:
        result = check(args.root)
    except (OSError, UnicodeError, ValueError) as exc:
        # Only exception type is emitted, not potentially sensitive OS details.
        result = {"status": "FAIL", "issues": [{"file": ".", "category": type(exc).__name__}]}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
