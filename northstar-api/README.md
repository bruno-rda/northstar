# northstar-api

Single FastAPI backend serving northstar-console and northstar-web.

## Setup

```bash
# Install Python 3.12
pyenv install 3.12

# Install dependencies
uv sync
```

## Run

```bash
# Start development server (default: http://localhost:8000)
uv run uvicorn main:app --reload --env-file .env
```

## Configuration

Copy the example environment file and edit as needed:

```bash
cp .env.example .env
```

## Development

```bash
# Everything CI runs
uv run ruff check . && uv run ruff format --check . && uv run mypy . && uv run pytest
```
