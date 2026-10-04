# Admin router dependency alignment — #686
Status: active. Development source-only.

ADM-DEP-001: Pair @tanstack/router-plugin 1.168.42 with @tanstack/react-router 1.170.41, satisfying declared ^1.170.41 peer, across manifest, importer and all resolved snapshot references.
ADM-DEP-002: Preserve compatible frozen PR680 af13452cb62522c9d27e50b3ee25521ae5bbb0ca and PR681 4d0a19f125b6be0cd3ce1dd67a3c243f0df2a133 dependency contributions, integrity metadata, direct pins, overrides and workflow gates. Reconcile overlapping lock graph coherently; do not mechanically merge old locks.
ADM-DEP-003: Provide full frozen source/Git-object byte manifests and self-review with explicit residual limits, then require fresh entire independent review. Generic JSON/text data operations are permitted; package manager, product parser/import/compiler/build/tests/native/CI execution are deferred.
ADM-DEP-004: Preserve prior failed evidence and existing bot/active owner branches; no merge, closure of old PRs, promotion, publication, deployment, settings/grants or cleanup. Source compatibility is not runtime acceptance or GA readiness.
