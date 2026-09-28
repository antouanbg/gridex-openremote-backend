"""Add the isolated static documentation host to the existing public proxy.

Preserves every existing API/auth/Manager rule. Requires a separately issued
trusted DNS-01 certificate and a healthy private gridex-docs container.
"""
from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import tempfile


def run(*args: str) -> str:
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT)


root = Path(__file__).resolve().parents[1]
runtime = Path.home() / "GrideX-runtime"
proxy_dir = runtime / "public-https-test"
config_path = proxy_dir / "nginx.conf"
source_cert = runtime / "acme/config/live/gridex-docs"
cert_dir = proxy_dir / "certs/docs"
proxy_name = "gridex-public-https-public-proxy-1"
proxy_image = "nginx@sha256:dc5069ad14f19660b141b21236140b91656bf89bbc3e2417c70ae650cd66104c"
block = (root / "deploy/public-https/docs-server.block").read_text()
start = "    # BEGIN GRIDEX PUBLIC DOCS"
end = "    # END GRIDEX PUBLIC DOCS"

old = config_path.read_text()
if "server_name api.gridex.tech;" not in old or "server_name auth.gridex.tech;" not in old:
    raise SystemExit("Existing API/auth hosts differ; inspect manually")
if old.count("server_name api.gridex.tech;") != 1 or old.count("server_name auth.gridex.tech;") != 1:
    raise SystemExit("Unexpected proxy host count; inspect manually")
if "# BEGIN GRIDEX PUBLIC MANAGER" not in old:
    raise SystemExit("Existing Manager configuration missing; refuse to overwrite")
if start in old:
    before, rest = old.split(start, 1)
    if end not in rest:
        raise SystemExit("Incomplete docs block; inspect manually")
    _, after = rest.split(end, 1)
    updated = before + block.rstrip() + after
else:
    if not old.rstrip().endswith("}"):
        raise SystemExit("Unexpected nginx.conf ending; inspect manually")
    index = old.rfind("}")
    updated = old[:index].rstrip() + "\n" + block + old[index:]

fullchain = source_cert / "fullchain.pem"
privkey = source_cert / "privkey.pem"
if not fullchain.is_file() or not privkey.is_file():
    raise SystemExit("Docs certificate missing; complete DNS-01 first")
certificate = run("openssl", "x509", "-in", str(fullchain), "-noout", "-ext", "subjectAltName")
if "DNS:doc.gridex.tech" not in certificate:
    raise SystemExit("Certificate does not cover doc.gridex.tech")
subprocess.run(["openssl", "x509", "-in", str(fullchain), "-noout", "-checkend", "2592000"], check=True, stdout=subprocess.DEVNULL)
cert_public_key = run("openssl", "x509", "-in", str(fullchain), "-pubkey", "-noout")
key_public_key = run("openssl", "pkey", "-in", str(privkey), "-pubout")
if cert_public_key != key_public_key:
    raise SystemExit("Certificate/private key mismatch")

run("docker", "exec", proxy_name, "wget", "-q", "-O", "/dev/null", "http://gridex-docs:8080/organisations-and-access/")
backup = Path(tempfile.mkdtemp(prefix="public-docs-", dir=runtime / "private-backups"))
os.chmod(backup, 0o700)
shutil.copy2(config_path, backup / "nginx.conf")
cert_dir.mkdir(mode=0o700, exist_ok=True)
for name in ("fullchain.pem", "privkey.pem"):
    if (cert_dir / name).exists():
        shutil.copy2(cert_dir / name, backup / name)

try:
    for src, name in ((fullchain, "fullchain.pem"), (privkey, "privkey.pem")):
        destination = cert_dir / name
        temporary = destination.with_suffix(destination.suffix + ".new")
        shutil.copyfile(src, temporary)
        os.chmod(temporary, 0o600)
        os.replace(temporary, destination)
    # nginx.conf is a *file bind mount*: replacing its inode breaks the
    # running container's mount. Write the validated content in-place and
    # recreate only this proxy service after an isolated nginx -t.
    config_path.write_text(updated)
    os.chmod(config_path, 0o600)
    run("docker", "run", "--rm", "--platform", "linux/arm64", "--read-only",
        "--tmpfs", "/tmp:size=16m,mode=1777",
        "--user", f"{os.getuid()}:{os.getgid()}",
        "-v", f"{config_path}:/etc/nginx/nginx.conf:ro",
        "-v", f"{proxy_dir / 'certs'}:/certs:ro", "--entrypoint", "nginx",
        proxy_image, "-t")
    run("docker-compose", "-f", str(proxy_dir / "compose.yml"),
        "--project-directory", str(proxy_dir), "up", "-d", "--no-deps",
        "--force-recreate", "public-proxy")
    run("docker", "exec", proxy_name, "nginx", "-t")
except Exception:
    shutil.copy2(backup / "nginx.conf", config_path)
    for name in ("fullchain.pem", "privkey.pem"):
        if (backup / name).exists():
            shutil.copy2(backup / name, cert_dir / name)
    run("docker-compose", "-f", str(proxy_dir / "compose.yml"),
        "--project-directory", str(proxy_dir), "up", "-d", "--no-deps",
        "--force-recreate", "public-proxy")
    run("docker", "exec", proxy_name, "nginx", "-t")
    raise

print(f"GRIDEX_DOCS_PROXY_ACTIVE backup={backup}")
