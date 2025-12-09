// eslint.config.mjs
import { defineConfig, globalIgnores } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  // Next.js + React + TS rules, Core Web Vitals as errors
  ...nextCoreWebVitals,

  // Optional: override default ignores if you want them explicit
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])
