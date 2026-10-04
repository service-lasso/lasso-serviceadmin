# SPEC-002: Current runtime-control source contract

Status: Active. Owner: #688 source author; parent coordinates independent review/admission.

## RC-001
The runtime-server source test must protect the existing runtime-control mechanism: verifier supplies both enablement flags and a random 32-byte hex nonce; Cypress Node task reads flags with their current OR semantics; browser consumes task enablement and cy.env URL/nonce, validates loopback endpoint/nonce, arms the real provider request with authenticated header, checks consumed receipt without nonce disclosure, retries the rendered consumer, rejects rearm, and deliberately reports the controlled negative result. No unused marker, synthetic fault, bypass, skip, DOM injection, timeout extension or weaker gate is allowed.

Replace only the obsolete browser-local realProviderControl literal assertion with exact owning-function/config/producer contract assertions. Retain every existing assertion and deadline except this stale literal. Preserve all original failed evidence. Source assertions are regression guards, not actual Cypress or native acceptance. Entire independent final-source review and a fresh complete execution admission precede any product import, parser, Node, package install, compiler, tests or native probe.

Umbrella authority: Core SPEC-007 AC-7G. Existing AGENTS.md and .github workflow remain authoritative. No bootstrap/adoption remediation; INIT-TODO is not applicable to this bounded test repair. No merge, release, promotion or deployment claim.