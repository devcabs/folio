# Reference: Configuration, Environment & Build Options

This document details all configuration objects, environment variables, build flags, and npm scripts in Folio Engine.

---

## 1. Engine Configuration (`src/config/engine.config.ts`)

The engine configuration is defined via `EngineConfig`:

```typescript
export interface EngineConfig {
  appId: string;                            // Unique application ID (e.g. 'showcase-app')
  appNamespace: string;                     // Storage prefix for localStorage & events (default: 'folio')
  basePath?: string;                        // Hosting base path (e.g. '/portal' or '')
  nodes: NodeItem[];                        // Array of sequence waypoints
  branding: EngineBrandingConfig;           // Branding and aesthetic settings
  securitySalt?: string;                    // Salt for PIN SHA-256 hash
  expectedPinHash?: string;                 // SHA-256 expected hash of 6-digit coordinator PIN
  features?: {
    enableChartDrawer?: boolean;            // Toggle in-browser chart drawer (default: true)
    enableEditorMode?: boolean;             // Toggle coordinator editing mode (default: true)
    enableHistoryLedger?: boolean;          // Toggle audit trail recording (default: true)
  };
}
```

### `EngineBrandingConfig`
```typescript
export interface EngineBrandingConfig {
  appName: string;                          // Application title in header
  tagline?: string;                         // Header subhead or tagline
  logoText?: string;                        // Text beside geometric mark (default: 'FOLIO')
  markSides?: number;                       // Number of vertices for ParametricShape (default: 8)
  markWaviness?: number;                    // Bézier ripple amplitude (0.0 to 1.0, default: 0.15)
  heroKicker?: string;                      // Hero section category tag
  heroTitle?: string;                       // Primary hero headline
  heroSubtitle?: string;                    // Hero descriptive subtitle
  orgName?: string;                         // Footer copyright or publisher name
}
```

---

## 2. Environment Variables (`.env`)

| Variable | Type | Description |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | String | Cloud Supabase project URL (`https://xyz.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | String | Public Supabase anonymous client key. |
| `VITE_EXPECTED_PIN_HASH` | String | SHA-256 hash of coordinator PIN. |
| `VITE_SECURITY_SALT` | String | Salt string concatenated with PIN before hashing. |

---

## 3. Package Scripts (`package.json`)

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts local Vite development server on port `5174`. |
| `npm run build` | Verifies token aliases, runs `tsc --noEmit`, and bundles standalone application in `dist/`. |
| `npm run build:lib` | Verifies token aliases, runs Vite Library Mode (`vite.config.lib.ts`), and generates TypeScript declaration files (`.d.ts`) via `tsc -p tsconfig.lib.json`. |
| `npm test` | Executes all Vitest unit and integration test suites. |
| `npm run test:purity` | Runs domain decoupling purity tests ensuring zero institutional domain terms exist. |
| `npm run test:tokens` | Scans all CSS and TSX files verifying 100% token purity and alias integrity. |
| `npm run deploy` | Runs the full 5-gate atomic release and deployment pipeline (`scripts/deploy.ts`). |
