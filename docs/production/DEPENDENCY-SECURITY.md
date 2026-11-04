# Dependency security update — 2026-11-01

The new audit identified moderate transitive vulnerabilities in glob and minimatch, used through @fastify/static and @sentry/node. The [glob advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) identifies14.0.2 as patched; the [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) identifies11.0.1 as patched.

package.json overrides pin glob14.0.3 and minimatch11.0.3, with package-lock.json updated. The existing Fastify5/@fastify/static10 combination is retained: the automatic force-fix suggestion would downgrade the static plugin to an incompatible major. Both patched packages support Node22. The static plugin's glob function API and the Sentry SDK module import are verified through application checks.

Validation: npm audit reports zero known vulnerabilities after installation; repository unit/integration tests, TypeScript/Vite build, static asset/SPA tests and real browser scenarios are rerun. See dependency-audit.log and VERIFICATION.md for evidence. The Sentry smoke check imports the SDK without a DSN and sends no telemetry.

These are pinned transitive overrides, so review them when upstream static/Sentry dependencies adopt the fixes. A zero audit count does not certify the application's complete security or replace staging penetration testing.
