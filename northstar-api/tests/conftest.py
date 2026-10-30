from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from main import app
from store import db


@pytest.fixture
def client() -> Iterator[TestClient]:
    db.reset()
    with TestClient(app) as c:
        yield c
