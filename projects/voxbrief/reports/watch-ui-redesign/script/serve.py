#!/usr/bin/env python3
"""
Voxbrief Watch UI Redesign Studio Local Server
Serves ./reports/watch-ui-redesign/site locally with auto port discovery and browser launch.
"""

import os
import sys
import socket
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler

SITE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "site"))

def find_free_port(start_port=8080, max_port=8100):
    for port in range(start_port, max_port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                continue
    return 8080

class SiteHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SITE_DIR, **kwargs)

    def log_message(self, format, *args):
        # Concise logging
        sys.stderr.write(f"[{self.log_date_time_string()}] {args[0]} {args[1]}\n")

def main():
    if not os.path.exists(SITE_DIR):
        print(f"Error: Site directory not found at {SITE_DIR}")
        sys.exit(1)

    port = find_free_port()
    url = f"http://localhost:{port}"

    server = HTTPServer(('127.0.0.1', port), SiteHandler)
    print("\n" + "=" * 65)
    print("  🎙️  VOXBRIEF WATCH OS & WEAR OS REDESIGN STUDIO")
    print("=" * 65)
    print(f"  • Serving site from: {SITE_DIR}")
    print(f"  • Local URL:        {url}")
    print("  • Press Ctrl+C to stop the server\n")
    print("=" * 65 + "\n")

    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"Note: Could not open browser automatically: {e}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server... Goodbye!")
        server.server_close()

if __name__ == "__main__":
    main()
