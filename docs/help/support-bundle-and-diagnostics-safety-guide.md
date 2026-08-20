---
title: Support Bundle and Diagnostics Safety Guide
description: Support bundle contents, redaction boundaries, local review steps, and related diagnostics surfaces.
status: metadata-only
tags: support, diagnostics, secrets-broker, redaction
---

# Support Bundle and Diagnostics Safety Guide

Status: metadata-only / backend contract required. The embedded support bundle
review helps operators inspect safe diagnostic metadata from Service Admin. It
does not prove that a live export backend exists, and the UI must not upload
diagnostics to a remote support system.

Use this guide with [Variables and Secrets Broker Safety Guide](variables-and-secrets-broker-safety-guide.md),
[Runtime and Logs Operator Runbook](runtime-and-logs-operator-runbook.md),
[Operations Telemetry Operator Guide](operations-telemetry-operator-guide.md),
and [Operations Audit Operator Guide](operations-audit-operator-guide.md).

## What Diagnostics Include

Support bundle diagnostics may include metadata that helps support triage:

- service ids, service names, versions, source refs, and lifecycle state
- runtime health states, readiness states, check ids, timestamps, and
  diagnostic refs
- service route and dependency refs that explain which surfaces may be affected
- Secrets Broker provider/source refs, lifecycle state, safe reason codes,
  affected service refs, and policy status
- Logs, Telemetry, and Audit refs that point to related evidence without copying
  raw payloads
- redaction policy names, redaction counts, section names, generated timestamp,
  and manifest metadata

Treat these fields as navigation and triage evidence. They can help identify the
affected service, provider, runtime check, operation, audit event, or correlation
id, but they are not a replacement for backend logs or a durable support case.

## What Is Excluded Or Redacted

Support diagnostics must not include raw values for:

- secret values, provider credentials, API keys, passwords, or private keys
- auth cookies, bearer tokens, access tokens, refresh tokens, id tokens, session
  secrets, or client secrets
- recovery material, seed material, backup keys, or generated credential output
- unredacted environment values
- raw request bodies, response bodies, provider responses, or diagnostic payload
  bodies
- screenshots that show visible secret or credential material

Redaction placeholders such as `[REDACTED_SECRET]` and
`[REDACTED_AUTHORIZATION]` are safety evidence, not credential material. If a
field is omitted or summarized by count, keep it omitted when copying evidence
into a support ticket.

## Export Availability

Support Bundle is currently an embedded diagnostic review action, not a
first-class sidebar page. The legacy `/support-bundle` route redirects operators
to the Secrets Broker sources context where safe diagnostics are reviewed.

Download/export remains unavailable until a redacted backend export API exists
and tests prove that generated bundles omit secrets, credentials, request
bodies, response bodies, environment values, and raw diagnostic payloads. Do not
describe a support bundle as exported, uploaded, or shared by Service Admin
unless that backend contract has shipped and the Help Center status is updated.

## Local Review Workflow

1. Open the Secrets Broker sources context and review the embedded support
   bundle or diagnostics panel.
2. Confirm the status is metadata-only and the export action is unavailable
   unless a shipped backend export contract says otherwise.
3. Review service ids, provider refs, operation ids, audit ids, correlation ids,
   health states, and diagnostic refs.
4. Check the redaction policy and any redaction counts before copying evidence.
5. Compare related Runtime, Logs, Telemetry, Audit, and Secrets Broker provider
   status so the support note points to the right surface.
6. Copy only metadata that has been locally reviewed. Do not copy raw values,
   request bodies, response bodies, provider tokens, cookies, private keys,
   recovery material, or environment values.

No upload is performed by the UI. Operators decide what metadata is safe to
share after local review.

## Related Surfaces

| Surface | How It Relates |
| --- | --- |
| Runtime | Confirms runtime health, readiness, and check refs before assuming a support bundle issue is isolated to one service. |
| Logs | Provides safe log lines and log refs. Use log evidence for timestamps and service outcomes without copying secret-bearing lines. |
| Telemetry | Shows trace, metric, log, exporter, and correlation posture. Treat exporter status as configuration metadata unless a sink proves receipt. |
| Audit | Shows operation ids, audit ids, reasons, and outcomes for policy-sensitive workflows. Use audit refs when explaining who approved or blocked an action. |
| Secrets Broker provider status | Shows provider/source lifecycle, policy state, lock/auth state, affected refs, and safe reason codes without provider credentials or raw secret values. |

When surfaces disagree, use the safest interpretation: the support bundle is a
metadata review aid, export is not available, and raw diagnostic payloads stay
out of tickets until a shipped backend contract proves otherwise.
