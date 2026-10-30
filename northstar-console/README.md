# northstar-console

Staff application for NORTHSTAR.

## Setup

```bash
# Install dependencies
npm install
```

## Run

```bash
# Start development server
npm run dev
```

## Configuration

Copy the example environment file and edit as needed:

```bash
cp .env.example .env.local
```

## Development

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Generate the API client from openapi.json (build does this too)
npm run gen:api

# Build for production (generate + typecheck + bundle)
npm run build
```
