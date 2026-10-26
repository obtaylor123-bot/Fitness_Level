# Security review notes

Last reviewed: October 26, 2026

## Dependency audit

`npm audit` reports **5 high-severity findings** in the installed dependency tree:

- `GHSA-86w9-cpqp-85rv` — `node-forge` RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements. The current upstream release is 1.4.0 and is still affected; no patched `node-forge` release was available when checked.
- `GHSA-mrhx-c7xc-m3w5` — Zod can exhaust memory when validating oversized constrained collections. The Expo CLI dependency resolves Zod 3.25.76; the patched release is Zod 4.6.6 or later.

The audit reports five instances because these findings are reached through `expo` -> `@expo/cli` and `@expo/code-signing-certificates`. The installed app uses Expo SDK 57.0.31 and the SDK 57 CLI 57.0.32, the current SDK 57 patch/minor releases checked. The CLI's declared signing dependency is `@expo/code-signing-certificates` 0.0.6. Version 0.0.7 is available, but its dependency is still `node-forge ^1.4.0`, so pinning it would not resolve the advisory. There is no newer compatible SDK 57 package version that removes the reported dependency paths.

These packages are Expo CLI/build/signing tooling, not imports from `App.tsx` or `src/`, and are not part of the app's JavaScript runtime bundle. They can affect developer machines and build pipelines that run Expo commands or signing workflows. A production dependency audit still reports them because Expo declares the CLI through its package dependency tree.

No npm override was applied. `node-forge` has no patched upstream version to pin, and the newer signing library still depends on the affected node-forge range. Zod's fix is a major-version change from the Expo CLI's declared Zod 3 range; forcing Zod 4 without Expo compatibility testing is not considered safe. `npm audit fix --force` proposes downgrading Expo to 44.0.6 and was not run. The non-forced compatible fixes removed other findings, including the critical `shell-quote` advisory, but did not resolve these five high findings.

## Reassessment triggers

Recheck this review when Expo publishes a patched SDK 57 CLI/signing dependency or `node-forge` publishes a fixed release. Reassess refunds, subscriptions, unsubscribe handling, cookie consent, and hidden-fee disclosures if payments, email marketing, analytics, or cookies are added.

## Remaining checks

This is a static code and dependency review. No device build, penetration test, or runtime security test has been performed. Review the draft privacy policy and terms with a qualified legal professional before release.
