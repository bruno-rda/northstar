"""Write the committed OpenAPI specs; with --sync, also copy them into the sibling frontends."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from console import console_api  # noqa: E402
from web import web_api  # noqa: E402

SURFACES = {"web": (web_api, "northstar-web"), "console": (console_api, "northstar-console")}


def render(name: str) -> str:
    # Match what the live mount serves, so the generated client's default baseUrl is right.
    spec = {**SURFACES[name][0].openapi(), "servers": [{"url": f"/{name}"}]}
    return json.dumps(spec, indent=2) + "\n"


def main() -> None:
    for name, (_, frontend) in SURFACES.items():
        spec = render(name)
        (ROOT / "openapi" / f"{name}.json").write_text(spec)
        if "--sync" in sys.argv:
            target = ROOT.parent / frontend / "openapi.json"
            if target.parent.is_dir():
                target.write_text(spec)
                print(f"synced {target}")


if __name__ == "__main__":
    main()
