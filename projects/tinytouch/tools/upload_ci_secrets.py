#!/usr/bin/env python3
"""
Uploads Apple Distribution Certificate and App Store Connect API Key to GitHub Repository Secrets
using the GitHub CLI (`gh`).
"""

import os
import re
import secrets
import subprocess
import sys
import tempfile

TEAM_ID = "68CTFST8W2"
ASC_KEY_ID = "4GZ563TKJ9"
ASC_ISSUER_ID = "b5e4b7d7-be75-481b-8416-3b5dced8c4ab"
ASC_KEY_PATH = os.path.expanduser("~/.appstoreconnect/private_keys/AuthKey_4GZ563TKJ9.p8")


def run_command(cmd, desc=None, check=True):
    if desc:
        print(f"==> {desc}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if check and result.returncode != 0:
        print(f"[ERROR] Command failed with exit code {result.returncode}: {' '.join(cmd)}")
        if result.stdout:
            print("STDOUT:", result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        sys.exit(result.returncode)
    return result


def set_gh_secret(name, value):
    print(f"Setting GitHub secret: {name}...")
    proc = subprocess.Popen(["gh", "secret", "set", name], stdin=subprocess.PIPE, text=True)
    proc.communicate(input=value)
    if proc.returncode != 0:
        print(f"[ERROR] Failed to set secret: {name}")
        sys.exit(proc.returncode)
    print(f"✓ {name} successfully updated.")


def main():
    print("==================================================")
    print("  TinyTouch GitHub Actions Secrets Provisioning   ")
    print("==================================================")

    # 1. Verify gh CLI
    run_command(["gh", "auth", "status"], "Verifying GitHub CLI authentication")

    # 2. Verify App Store Connect Key
    if not os.path.exists(ASC_KEY_PATH):
        print(f"[ERROR] App Store Connect key file not found at: {ASC_KEY_PATH}")
        sys.exit(1)

    with open(ASC_KEY_PATH, "rb") as f:
        p8_bytes = f.read()

    p8_base64 = subprocess.run(["base64"], input=p8_bytes, capture_output=True, check=True).stdout.decode().strip()
    print("✓ App Store Connect API Key loaded & base64 encoded.")

    # 3. Export Apple Distribution Certificate and Private Key from Keychain
    keychain_path = os.path.expanduser("~/Library/Keychains/login.keychain-db")
    if not os.path.exists(keychain_path):
        keychain_path = os.path.expanduser("~/Library/Keychains/login.keychain")

    temp_export_pass = secrets.token_hex(16)
    p12_raw = tempfile.mktemp(suffix=".p12")
    cert_pem = tempfile.mktemp(suffix=".pem")
    key_pem = tempfile.mktemp(suffix=".pem")
    p12_clean = tempfile.mktemp(suffix=".p12")

    try:
        print(f"Exporting identities from keychain ({keychain_path})...")
        run_command([
            "security", "export",
            "-k", keychain_path,
            "-t", "identities",
            "-f", "pkcs12",
            "-P", temp_export_pass,
            "-o", p12_raw
        ], check=True)

        # Parse bags using openssl
        res = subprocess.run([
            "openssl", "pkcs12",
            "-in", p12_raw,
            "-passin", f"pass:{temp_export_pass}",
            "-nodes"
        ], capture_output=True, text=True, check=True)

        dist_cert = None
        dist_key = None

        for bag in res.stdout.split("Bag Attributes"):
            if "BEGIN CERTIFICATE" in bag and f"Apple Distribution: HEJI TECHNOLOGY LLC ({TEAM_ID})" in bag:
                m = re.search(r"(-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----)", bag, re.DOTALL)
                if m:
                    dist_cert = m.group(1)
            elif "BEGIN PRIVATE KEY" in bag and "friendlyName: Apple Distribution: HEJI TECHNOLOGY LLC" in bag:
                m = re.search(r"(-----BEGIN PRIVATE KEY-----.*?-----END PRIVATE KEY-----)", bag, re.DOTALL)
                if m:
                    dist_key = m.group(1)

        if not dist_cert or not dist_key:
            print("[ERROR] Failed to extract Apple Distribution certificate or matching private key!")
            sys.exit(1)

        with open(cert_pem, "w") as f:
            f.write(dist_cert + "\n")
        with open(key_pem, "w") as f:
            f.write(dist_key + "\n")

        # Verify RSA modulus match
        cert_mod = subprocess.run(["openssl", "x509", "-noout", "-modulus", "-in", cert_pem], capture_output=True, text=True, check=True).stdout.strip()
        key_mod = subprocess.run(["openssl", "rsa", "-noout", "-modulus", "-in", key_pem], capture_output=True, text=True, check=True).stdout.strip()

        if cert_mod != key_mod:
            print("[ERROR] Modulus mismatch between Apple Distribution cert and private key!")
            sys.exit(1)

        print("✓ Verified matching Apple Distribution certificate and private key.")

        # Export to clean standalone p12
        p12_password = secrets.token_hex(24)
        run_command([
            "openssl", "pkcs12", "-export",
            "-out", p12_clean,
            "-inkey", key_pem,
            "-in", cert_pem,
            "-name", f"Apple Distribution: HEJI TECHNOLOGY LLC ({TEAM_ID})",
            "-passout", f"pass:{p12_password}"
        ], desc="Generating clean standalone distribution .p12")

        with open(p12_clean, "rb") as f:
            p12_bytes = f.read()

        p12_base64 = subprocess.run(["base64"], input=p12_bytes, capture_output=True, check=True).stdout.decode().strip()
        print("✓ Distribution .p12 packaged and base64 encoded.")

    finally:
        for p in [p12_raw, cert_pem, key_pem, p12_clean]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

    # 4. Generate random temporary keychain password for CI
    ci_keychain_password = secrets.token_hex(24)

    # 5. Upload secrets to GitHub
    print("\n==> Uploading secrets to GitHub repository...")
    secrets_to_upload = {
        "APPLE_TEAM_ID": TEAM_ID,
        "APP_STORE_CONNECT_API_KEY_ID": ASC_KEY_ID,
        "APP_STORE_CONNECT_API_ISSUER_ID": ASC_ISSUER_ID,
        "APP_STORE_CONNECT_API_KEY_BASE64": p8_base64,
        "IOS_DIST_SIGNING_CERT_P12_BASE64": p12_base64,
        "IOS_DIST_SIGNING_CERT_PASSWORD": p12_password,
        "IOS_CI_KEYCHAIN_PASSWORD": ci_keychain_password,
        # Nana compatible aliases
        "APPLE_API_KEY_ID": ASC_KEY_ID,
        "APPLE_API_ISSUER": ASC_ISSUER_ID,
        "APPLE_API_KEY": p8_base64,
        "IOS_DISTRIBUTION_CERTIFICATE": p12_base64,
        "IOS_DISTRIBUTION_CERTIFICATE_PASSWORD": p12_password,
    }

    for name, val in secrets_to_upload.items():
        set_gh_secret(name, val)

    print("\n==================================================")
    print("🎉 ALL REPOSITORY SECRETS SUCCESSFULLY CONFIGURED!")
    print("==================================================")
    run_command(["gh", "secret", "list"], "Listing configured GitHub secrets")


if __name__ == "__main__":
    main()
