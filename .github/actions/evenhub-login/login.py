"""Logs the Even Hub CLI in without a person at the keyboard.

`evenhub login` reads the password only from an interactive prompt (no flag, environment variable
or stdin), so this runs it in a pseudo-terminal and answers the prompt. Reads EVENHUB_EMAIL and
EVENHUB_PASSWORD; argv is the command that runs the CLI (e.g. npx -y -p <pkg> evenhub). The
credentials land where the CLI keeps them (XDG_CONFIG_HOME/evenhub/credentials.yaml).
Exits with the CLI's exit code, or 1 when the prompt never appears.
"""
import os
import pty
import select
import sys
import time

email, password = os.environ["EVENHUB_EMAIL"], os.environ["EVENHUB_PASSWORD"]
pid, fd = pty.fork()
if pid == 0:
    os.execvp(sys.argv[1], sys.argv[1:] + ["login", "-e", email])

out, sent, deadline = b"", False, time.time() + 180
while time.time() < deadline:
    ready, _, _ = select.select([fd], [], [], 1)
    if not ready:
        continue
    try:
        chunk = os.read(fd, 4096)
    except OSError:  # the CLI exited and closed the terminal
        break
    if not chunk:
        break
    out += chunk
    if not sent and b"Password" in out:
        os.write(fd, password.encode() + b"\r")
        sent = True

_, status = os.waitpid(pid, 0)
# The prompt masks the password; print the transcript so failures are readable.
sys.stdout.write(out.decode(errors="replace").replace(password, "***") + "\n")
if not sent:
    print("::error::evenhub login never asked for the password")
    sys.exit(1)
sys.exit(os.waitstatus_to_exitcode(status))
