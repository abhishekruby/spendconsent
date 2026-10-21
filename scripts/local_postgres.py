#!/usr/bin/env python3
"""Manually initialize/start only this project's isolated PostgreSQL cluster.

No shared server, passwords, resets, automatic shutdown or global service changes.
"""
import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / ".runtime/postgres-data"
MARKER = ROOT / ".runtime/postgres-project.json"
BIN = Path("/usr/lib/postgresql/16/bin")
PORT = 55432
BOOTSTRAP = "spendconsent_bootstrap"
APP = "spendconsent_app"


def socket_path(root=ROOT):
    suffix = hashlib.sha256(str(root).encode()).hexdigest()[:12]
    return Path(tempfile.gettempdir()) / f"spendconsent-{os.getuid()}-{suffix}"


def private_directory(path):
    if path.is_symlink():
        raise RuntimeError("Refusing a symbolic-link runtime directory")
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = path.stat()
    if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
        raise RuntimeError("Existing runtime directory must be owned by this user and mode 0700")


def run(binary, *args):
    # Only fixed/local SQL and paths enter these commands; no private config is read.
    return subprocess.run([str(BIN / binary), *map(str, args)], check=True,
                          capture_output=True, text=True)


def sql(command, database="postgres"):
    return run("psql", "-X", "-h", socket_path(), "-p", PORT,
               "-U", BOOTSTRAP, "-d", database, "-v", "ON_ERROR_STOP=1", "-Atc", command).stdout.strip()


def verify_marker():
    if MARKER.is_symlink() or not MARKER.is_file() or json.loads(MARKER.read_text()) != {"root": str(ROOT), "data": str(DATA)}:
        raise RuntimeError("Unidentified existing cluster: refusing to change or start it")
    private_directory(DATA)


def initialize():
    if DATA.exists() or MARKER.exists():
        verify_marker()
        return
    DATA.parent.mkdir(exist_ok=True)
    private_directory(DATA)
    private_directory(socket_path())
    run("initdb", "-D", DATA, "-U", BOOTSTRAP, "--no-locale", "--encoding=UTF8",
        "--auth-local=peer", "--auth-host=reject")
    # These files belong to the newly created project cluster only.
    with (DATA / "postgresql.conf").open("a") as stream:
        stream.write(f"\nlisten_addresses = ''\nport = {PORT}\nunix_socket_directories = '{socket_path()}'\n"
                     "unix_socket_permissions = 0700\nshared_buffers = '32MB'\nwork_mem = '2MB'\n"
                     "max_connections = 20\nautovacuum_max_workers = 1\nlogging_collector = off\n"
                     # Keep dynamic shared memory in the data directory: desktop session
                     # cleanup (systemd RemoveIPC) can wipe /dev/shm under a running server.
                     "dynamic_shared_memory_type = mmap\n")
    user = getpass.getuser().replace('"', '""')
    (DATA / "pg_ident.conf").write_text(
        f'project_bootstrap "{user}" {BOOTSTRAP}\nproject_app "{user}" {APP}\n')
    (DATA / "pg_hba.conf").write_text(
        f"local all {BOOTSTRAP} peer map=project_bootstrap\n"
        f"local spendconsent {APP} peer map=project_app\n"
        f"local test_spendconsent {APP} peer map=project_app\nlocal all all reject\n")
    descriptor = os.open(MARKER, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        json.dump({"root": str(ROOT), "data": str(DATA)}, stream)


def start():
    verify_marker()
    private_directory(socket_path())
    status = subprocess.run([str(BIN / "pg_ctl"), "-D", str(DATA), "status"], capture_output=True)
    if status.returncode == 3:
        # A different process/socket is never stopped or adopted.
        if (socket_path() / f".s.PGSQL.{PORT}").exists():
            raise RuntimeError("Project socket is occupied; refusing startup")
        log = ROOT / ".runtime/postgres.log"
        descriptor = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_APPEND | os.O_NOFOLLOW, 0o600)
        os.close(descriptor)
        run("pg_ctl", "-D", DATA, "-l", log, "-w", "start")
    elif status.returncode:
        raise RuntimeError("Could not identify project cluster status")
    if sql("SHOW data_directory") != str(DATA):
        raise RuntimeError("Connected cluster identity mismatch")
    if sql("SHOW listen_addresses") != "":
        raise RuntimeError("Project PostgreSQL must have TCP disabled")
    if sql(f"SELECT count(*) FROM pg_roles WHERE rolname='{APP}'") == "0":
        sql(f"CREATE ROLE {APP} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION")
    if sql(f"SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication FROM pg_roles WHERE rolname='{APP}'") != "f":
        raise RuntimeError("Application role has unexpected elevated privileges")
    for name in ("spendconsent", "test_spendconsent"):
        if sql(f"SELECT count(*) FROM pg_database WHERE datname='{name}'") == "0":
            sql(f"CREATE DATABASE {name} OWNER {APP}")
        if sql(f"SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='{name}'") != APP:
            raise RuntimeError("Project database owner mismatch")
    print(json.dumps({"database": "spendconsent", "test_database": "test_spendconsent",
                      "role": APP, "socket": str(socket_path()), "port": PORT,
                      "tcp": False, "pid": int((DATA / "postmaster.pid").read_text().splitlines()[0])}))


def self_test():
    assert socket_path() == socket_path(ROOT)
    assert socket_path(ROOT / "other") != socket_path()
    assert len(str(socket_path() / f".s.PGSQL.{PORT}")) < 100
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "private"
        private_directory(path)
        private_directory(path)
        path.chmod(0o755)
        try:
            private_directory(path)
        except RuntimeError:
            pass
        else:
            raise AssertionError("insecure directory accepted")
    print("local_postgres self-test PASS; no PostgreSQL process or database touched")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--init", action="store_true")
    parser.add_argument("--start", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    try:
        if args.self_test:
            self_test()
        else:
            if args.init:
                initialize()
            if args.start:
                start()
            if not (args.init or args.start):
                parser.print_help()
    except (RuntimeError, subprocess.CalledProcessError, OSError, ValueError):
        raise SystemExit("Project PostgreSQL setup failed safely; inspect only project-local diagnostics")
