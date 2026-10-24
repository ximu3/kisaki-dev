"""Record primary sources for the confirmed OAuth relay organization."""

import hashlib
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCES = {
    "hono-node": (
        "https://hono.dev/docs/getting-started/nodejs",
        ("@hono/node-server", "SIGTERM"),
    ),
    "hono-testing": (
        "https://hono.dev/docs/guides/testing",
        ("app.request", "Response"),
    ),
    "oauth-core": (
        "https://www.rfc-editor.org/rfc/rfc6749.html",
        ("authorization_code", "refresh_token", "redirect_uri"),
    ),
    "pkce": (
        "https://www.rfc-editor.org/rfc/rfc7636.html",
        ("S256", "code_verifier", "code_challenge"),
    ),
    "native-apps": (
        "https://www.rfc-editor.org/rfc/rfc8252.html",
        ("loopback", "127.0.0.1"),
    ),
    "oauth-security": (
        "https://www.rfc-editor.org/rfc/rfc9700.html",
        ("exact string matching", "PKCE"),
    ),
    "bangumi-auth": (
        "https://raw.githubusercontent.com/bangumi/api/65d29cff2331e08c0110d30d515f7f1b6488f845/docs-raw/How-to-Auth.md",
        ("client_secret", "refresh_token"),
    ),
    "anilist-auth": (
        "https://raw.githubusercontent.com/AniList/docs/master/docs/guide/auth/index.md",
        ("Refresh tokens", "OAuth2"),
    ),
    "google-web-auth": (
        "https://developers.google.com/identity/protocols/oauth2/web-server",
        ("redirect_uri", "refresh_token", "https://oauth2.googleapis.com/token"),
    ),
    "docker-compose-model": (
        "https://docs.docker.com/compose/intro/compose-application-model/",
        ("compose.yaml", "services"),
    ),
    "docker-compose-environment": (
        "https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/",
        ("environment", "env_file"),
    ),
    "docker-build-context": (
        "https://docs.docker.com/build/concepts/context/",
        (".dockerignore", "context"),
    ),
}


def fetch(item):
    name, (url, markers) = item
    request = urllib.request.Request(
        url, headers={"User-Agent": "Kisaki-design-verification"}
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        data = response.read()
        receipt = {
            "name": name,
            "url": url,
            "finalUrl": response.url,
            "status": response.status,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        }
    body = data.decode("utf-8")
    if not all(marker in body for marker in markers):
        raise ValueError(f"An expected source marker is absent: {name}.")
    receipt["presentMarkers"] = list(markers)
    return receipt


def main():
    with ThreadPoolExecutor(max_workers=4) as executor:
        receipts = list(executor.map(fetch, SOURCES.items()))
    result = {
        "purpose": "source evidence for organization, not OAuth flow execution",
        "designStatus": "organization-confirmed",
        "relayProjectCreated": False,
        "containerImageBuilt": False,
        "composeExecuted": False,
        "relayHttpServerExecuted": False,
        "simulatedProtocolExecuted": False,
        "upstreamAuthorizationExecuted": False,
        "clientConsumptionExecuted": False,
        "currentDeploymentInspected": False,
        "dependencyVersionsAndConfigLocked": False,
        "sources": receipts,
    }
    output = ROOT / "organization-source-contract.json"
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sourceReceipts": len(receipts), "relayExecuted": False}))


if __name__ == "__main__":
    main()
