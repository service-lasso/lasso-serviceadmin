# SPEC-001: First-run diagnostic source loadability

Status: Active. Owner: issue #684 source author; parent coordinates independent review/admission and merge.

## FR-SYNTAX-001
The first-run diagnostic module must load through its existing callers without an unmatched standalone closing brace. Remove only the brace after the already complete capture function. Preserve all existing functions, imports, exports, limits, error handling, safe diagnostic codes, native-birth observations, privacy controls and projection schemas byte-for-byte outside that line.

Acceptance: the product diff is one deleted brace line; no caller, contract or test edits. A fresh entire source review and complete final-input ROOT must precede locally executing any product/parser/compiler/syntax/test/native probe. Existing package checks and first-run tests remain prospective required verification, with exact-head natural hosted failures retained separately. No author-created mirror test can substitute for these gates.

Scope: source repair and reviewable evidence only. Merge, runtime/package acceptance, publication, deployment and GA remain separate decisions and claims.