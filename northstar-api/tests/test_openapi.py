from pathlib import Path

import pytest

from scripts.dump_openapi import ROOT, SURFACES, render


@pytest.mark.parametrize("name", SURFACES)
def test_committed_spec_is_current(name: str) -> None:
    committed = (Path(ROOT) / "openapi" / f"{name}.json").read_text()
    assert committed == render(name), "Spec is stale: run `uv run python scripts/dump_openapi.py`"
