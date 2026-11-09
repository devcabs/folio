---
name: security-guidance
description: Security auditing, vulnerability scanning, safe client/edge operations, and secret protection.
---

# Security Guidance & Audit Standards

> **PREVALENCE NOTICE:** Enforces client-side and edge security, secret management, and input sanitization across Folio Engine.

## Security Gates

1. **Zero Secret Leakage**:
   - Never commit sensitive tokens, private keys, or credentials into source files or client bundles.
   - Verify that build artifacts in `dist/` contain no environment secrets.

2. **Input Sanitization & Injection Prevention**:
   - Sanitize all external inputs, Google Sheets feeds, and CSV data before rendering in SVG charts (`src/utils/chartSanitizer.ts`).
   - Prevent XSS vulnerabilities in user-generated markdown or HTML content blocks.

3. **Edge Function Security**:
   - Validate request headers, origins, and authorization tokens on Cloudflare Pages Functions and Supabase endpoints.
