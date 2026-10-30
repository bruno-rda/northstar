import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './openapi.json',
  output: 'src/api',
  plugins: [
    { name: '@hey-api/client-fetch', throwOnError: true },
    { name: '@hey-api/sdk', responseStyle: 'data' },
    { name: '@hey-api/typescript', enums: 'javascript' },
    { name: '@tanstack/react-query' },
  ],
})
