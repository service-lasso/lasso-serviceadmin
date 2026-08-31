# Security Policy

## Supported versions

Until Service Lasso 1.0 reaches GA, only the current Admin `develop` candidate
receives security fixes. After GA, the latest Release 1.x Admin line is
supported unless a release notice explicitly extends support. Superseded dated
releases and development snapshots are unsupported.

## Reporting a vulnerability

Use GitHub private vulnerability reporting. Do not open a public vulnerability
issue or include tokens, cookies, secret values, recovery material, private
keys, local paths, raw responses, screenshots, or exploit data in public
evidence. If private reporting is unavailable, contact the repository owner
privately with the minimum safe reproduction.

Reports should identify the affected version/commit, preconditions, impact,
safe reproduction, and known mitigation. We will acknowledge, assess production
reachability, coordinate remediation/advisory handling, and preserve a
disclosure timeline.

## Remediation targets

- Critical production findings: triage within 24 hours; fix or fail-closed
  mitigation targeted within 72 hours.
- High production findings: triage within 2 business days; fix targeted within
  7 days.
- Medium production findings: fix targeted within 30 days.
- Low production findings: fix targeted within 90 days.

Release 1.0 fails for any known unremediated production vulnerability. These
targets do not claim immunity from unknown or future vulnerabilities.

## Release evidence

Release evidence binds the exact commit and pnpm graph, production and tooling
audits, three platform archives, SBOMs, checksums, provenance/attestations,
signatures, asset sizes/digests, and released Admin-to-Core-to-Broker browser
qualification. Fixtures, source builds, or a healthy page are not final proof.

