# ArgOS State Manifold Integration Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated cross-process POSIX shared-memory experiment and verification harness proving whether a shared-memory data plane can coexist with the existing ArgOS Event Bus, StateEngine, TCS, and Knowledge Vault without changing frozen core behavior.

**Architecture:** Everything lives under `experiments/state-manifold/`. A small native C11 substrate owns a fixed-size, versioned shared-memory region with two slots, process-shared robust synchronization, commit markers, and checksum validation. A Node/TypeScript harness launches independent writer/reader processes, exercises the existing `SNAPSHOT_RESTORE` Event Bus path and `stateEngine.processEvent()`, records TCS evidence, verifies Vault evidence in an isolated working directory, and emits machine-readable results. Production `server/` code remains untouched.

**Tech Stack:** C11, POSIX `shm_open`/`mmap`/`ftruncate`, pthread process-shared robust mutexes, Node child processes, TypeScript via existing `tsx`, Node built-in test runner/assertions, existing ArgOS Event Bus/StateEngine/TCS/KnowledgeVault.

## Global Constraints

- Experimental only; no frozen-core modification.
- No trading fields, imports, or behavior.
- Event Bus remains control/notification plane.
- Manifold is not authoritative merely because it is fast.
- `SNAPSHOT_RESTORE` is the only existing Event Bus event used for the test projection.
- Raw manifold bytes never enter the Vault as a substitute for the data plane.
- Vault testing occurs outside the repository's baseline ledger.
- No production daemon, semantic chunk engine, financial machinery, or optimization pass.
- No inherited 14-nanosecond/performance claim is treated as measured.
- Every proof emits machine-readable evidence.
- Native compilation uses `cc -std=c11 -Wall -Wextra -Werror -pthread`.
- No network or external service is required.
- Follow TDD: each production behavior begins with a failing test/proof assertion.

## File Map

Create:
- `experiments/state-manifold/native/state_manifold.h` — ABI/layout.
- `experiments/state-manifold/native/state_manifold.c` — shared-memory lifecycle, publish/read/recovery/checksum.
- `experiments/state-manifold/native/state_manifold_cli.c` — minimal JSON CLI.
- `experiments/state-manifold/harness/types.ts` — proof/result types.
- `experiments/state-manifold/harness/manifest.ts` — deterministic test payload/constants.
- `experiments/state-manifold/harness/child.ts` — independent writer/reader/recovery child modes.
- `experiments/state-manifold/harness/argOSProbe.ts` — isolated Event Bus/StateEngine/TCS/Vault seam.
- `experiments/state-manifold/harness/runner.ts` — six-case orchestration.
- `experiments/state-manifold/harness/assertions.test.ts` — executable proof assertions.
- `experiments/state-manifold/results/.gitkeep` — output directory marker.
- `experiments/state-manifold/RESULTS.md` — measured decision record.

Modify:
- `experiments/README.md` — isolated experiment note.
- `package.json` — only the two state-manifold test scripts.
- `.gitignore` — ignore generated binary/result files.

Do not modify any `server/` production source.

---

### Task 1: Define and test the native ABI

**Files:** header + proof test.

**Interface:**
```c
sm_create(const char *name, size_t payload_capacity)
sm_open(const char *name)
sm_publish(sm_handle_t *, const void *, uint32_t, uint64_t)
sm_read(sm_handle_t *, void *, uint32_t, sm_record_meta_t *)
sm_corrupt_active(sm_handle_t *)
sm_close(sm_handle_t *)
sm_destroy(const char *name)
```

Use ABI version 1, two slots, 4096-byte payload capacity, magic `ARGOSMAN`, active-slot index, generation, and a process-shared mutex. Each slot contains `sequence_begin`, `epoch`, `payload_len`, checksum, payload, and `sequence_end`.

- [ ] Write a failing layout test expecting `abiVersion=1`, `slotCount=2`, `payloadCapacity=4096`, checksum `fnv1a64`.
- [ ] Run `npm run test:state-manifold -- --test-name-pattern="ABI layout"`; verify expected missing-CLI failure.
- [ ] Implement the header and explicit status codes.
- [ ] Compile a minimal CLI exposing layout constants; verify the test passes.
- [ ] Commit: `test: define state manifold ABI proof`.

### Task 2: Implement the native POSIX substrate

**Files:** `state_manifold.c`, `state_manifold_cli.c`, proof test.

- [ ] Write a failing independent writer/reader visibility test.
- [ ] Implement `shm_open` + `ftruncate` + `mmap(MAP_SHARED)` creation and independent attachment.
- [ ] Initialize `PTHREAD_PROCESS_SHARED`; use robust mutex support where available.
- [ ] Implement publication under the mutex: choose inactive slot, mark sequence in-progress, copy bounded payload, calculate FNV-1a64, write metadata, finalize even sequence markers, then publish active slot/generation.
- [ ] Implement stable reads that accept only a committed, even-sequence, bounds-valid, checksum-valid slot.
- [ ] Implement `corrupt-active` by changing a payload byte without changing checksum.
- [ ] Implement close/unmap and `shm_unlink` destruction.
- [ ] Compile with `cc -std=c11 -Wall -Wextra -Werror -pthread ...` and require zero warnings.
- [ ] Run visibility proof; require different PIDs and identical payload/epoch/checksum.
- [ ] Commit: `feat: add isolated POSIX state manifold substrate`.

### Task 3: Build the independent TypeScript process harness

**Files:** `types.ts`, `manifest.ts`, `child.ts`, `runner.ts`, test.

**Core type:**
```ts
interface ProofResult {
  caseName: string;
  passed: boolean;
  processIds: number[];
  manifoldName: string;
  epoch?: number;
  checksum?: string;
  correlationId: string;
  causalChain: string[];
  eventBusEvidence: Record<string, unknown>[];
  stateEngineEvidence: Record<string, unknown>[];
  tcsEvidence: Record<string, unknown>[];
  vaultVerification: Record<string, unknown>;
  failureReason?: string;
}
```

- [ ] Write failing PID-separation test.
- [ ] Run and verify failure before child launcher exists.
- [ ] Define deterministic generic payload, e.g. `stateId`, `posture`, `revision`, `marker`, numeric values; serialize deterministically.
- [ ] Implement writer/reader/recover-reader child modes using `child_process.spawn` and one JSON result line per child.
- [ ] Give every case a unique shm name and correlation ID; clean up in `finally`.
- [ ] Run PID-separation test and require PASS.
- [ ] Commit: `test: add cross-process manifold harness`.

### Task 4: Prove Event Bus -> StateEngine correspondence

**Files:** `argOSProbe.ts`, `runner.ts`, test.

**Interface:** `runArgOSProjection(manifoldMeta, correlationId, causationId): Promise<ArgOSProjectionEvidence>`.

- [ ] Write failing test that dispatches existing `NexusEvent.SNAPSHOT_RESTORE` and expects the exact manifold epoch/checksum to appear in `marketState`.
- [ ] Run and verify failure.
- [ ] Implement the probe in a separate Node process so singleton Event Bus/StateEngine state is isolated.
- [ ] Import existing `eventBus`, `NexusEvent`, and `stateEngine`; call `stateEngine.initialize()` once.
- [ ] Dispatch only `SNAPSHOT_RESTORE` with a test-only `state` projection containing epoch/checksum/correlation ID.
- [ ] Capture Event Bus evidence and resulting state projection.
- [ ] Assert raw manifold payload is absent from the event payload.
- [ ] Run correspondence proof and require PASS.
- [ ] Commit: `test: prove manifold to ArgOS state projection seam`.

### Task 5: Prove TCS causality and isolated Vault evidence

**Files:** `argOSProbe.ts`, `runner.ts`, test.

- [ ] Write failing test requiring the ordered TCS chain `MANIFOLD_WRITE -> MANIFOLD_PUBLISHED -> MANIFOLD_READ -> STATE_PROJECTED`.
- [ ] Run and verify failure.
- [ ] Log four TCS entries with one correlation/task ID and epoch/checksum metadata.
- [ ] Run the Vault probe in a temporary working directory before importing `KnowledgeVault`, so its JSONL storage is outside the repository.
- [ ] Ingest only compact `state_manifold_proof` metadata: epoch, checksum, correlation ID, causal chain.
- [ ] Call `knowledgeVault.verifyLedgerIntegrity()` and return the result plus entry ID.
- [ ] Verify repository `data/vault/knowledge.jsonl` is unchanged.
- [ ] Run causal/Vault proofs and require PASS.
- [ ] Commit: `test: record causal and durable manifold evidence`.

### Task 6: Prove writer failure recovery and corruption rejection

**Files:** native implementation/CLI, child, runner, test.

- [ ] Write failing recovery test: publish valid record, SIGKILL writer, attach fresh reader, require last committed record remains readable.
- [ ] Run and verify failure.
- [ ] Implement robust-mutex `EOWNERDEAD` handling; validate active slot before marking mutex consistent. Never promote an invalid record.
- [ ] Write failing corruption test: publish, corrupt active payload, read, require non-zero exit and checksum/consistency error.
- [ ] Run and verify failure.
- [ ] Implement strict FNV-1a64 validation and committed-record checks.
- [ ] Run both failure proofs; require PASS.
- [ ] Commit: `test: prove manifold recovery and corruption rejection`.

### Task 7: Assemble all six machine-readable proof cases

**Files:** runner, test, package scripts, gitignore, results marker.

Cases must be exactly:
```text
cross-process-visibility
event-data-correspondence
causal-trace
durable-evidence
writer-failure-recovery
corruption-rejection
```

- [ ] Write failing aggregate test requiring all six cases and all `passed === true`.
- [ ] Run and verify failure.
- [ ] Execute cases sequentially with fresh manifold/correlation IDs.
- [ ] Emit JSON with experiment name, ABI version, measured flag, cases, and pass/fail summary; keep raw payload out of Vault/evidence.
- [ ] Add scripts:
```json
"test:state-manifold:build": "cc -std=c11 -Wall -Wextra -Werror -pthread experiments/state-manifold/native/state_manifold.c experiments/state-manifold/native/state_manifold_cli.c -o experiments/state-manifold/native/state_manifold_cli",
"test:state-manifold": "npm run test:state-manifold:build && tsx --test experiments/state-manifold/harness/assertions.test.ts"
```
- [ ] Run `npm run test:state-manifold`; require six PASS results.
- [ ] Verify generated result files and Vault baseline are not tracked.
- [ ] Commit: `test: complete ArgOS state manifold integration proof`.

### Task 8: Record measured result and decision boundary

**Files:** `RESULTS.md`, `experiments/README.md`, documentation test.

- [ ] Write failing documentation test requiring all six case names, measured-vs-claim distinction, and explicit no-production-integration statement.
- [ ] Run and verify failure.
- [ ] Record only measured outcomes: pass/fail, actual timing if measured, PIDs, epochs, checksums, causal evidence, and integrity results.
- [ ] Explicitly separate recovered ArgEcosystem mechanisms from this experiment's measurements.
- [ ] If all six pass, record `SECOND-STAGE CANDIDATE`; otherwise record `REJECTED FOR INTEGRATION` with the failing boundary.
- [ ] State that a pass proves only technical compatibility of an experimental data-plane candidate; it does not make the manifold canonical.
- [ ] Run documentation test and require PASS.
- [ ] Commit: `docs: record state manifold proof boundary`.

## Final Verification Gate

Run:
```bash
npm run lint
npm run test:state-manifold
npm run build
git status --short
```

Require TypeScript compilation, all six proofs, existing application build, unchanged frozen-core source, unchanged repository Vault baseline, zero trading imports in the experiment, and zero unsupported performance claims presented as measurements.

## Failure Budget

Allowed: inherited ArgEcosystem performance expectations, optional optimization, and portability outside the Linux/POSIX test environment.

Not allowed: visibility failure, checksum acceptance of corrupt data, partial-record publication, unrecoverable writer failure, Event Bus correspondence failure, StateEngine projection failure, TCS causal reconstruction failure, Vault integrity failure, or frozen-core contamination.

## Risk Tags

- Architectural integration: MEDIUM
- POSIX/process synchronization: HIGH
- Performance claims: HIGH until benchmarked
- Recovery/corruption correctness: HIGH
- Core contamination: LOW if file boundary holds
- Trading contamination: LOW
- Scope creep: LOW

## Completion State

`EXPAND` remains active until evidence exists. A successful proof earns only:

```text
STATE MANIFOLD = technically compatible experimental data-plane candidate
```

It does not earn:

```text
STATE MANIFOLD = canonical ArgOS state store
```

Canonical promotion requires a separate approved design based on measured proof results.
