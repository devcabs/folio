# CI: Changelog Verification

Add this step to your CI workflow on PRs targeting `main`:

```yaml
- name: Verify changelog is current
  run: npx folio-engine changelog --verify
```

This step fails if `ledger.ts` has entries not reflected in `CHANGELOG.md`.

> **Note:** In `@devcabs/folio-engine`, `CHANGELOG.md` is excluded from source control (`.gitignore`) and excluded from the published npm tarball (`"files": ["dist"]` in `package.json`).

