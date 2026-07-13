# Multi-mode commerce image studio design

## Summary

Extend Amazon Image Studio into a multi-mode commerce image workspace while preserving the existing Amazon Listing and A+ behavior. The product will add a product facts assistant, universal platform planning, free creation, reference-set reconstruction, concurrent batch projects, similarity-risk review, and structured local export.

Implementation is incremental. Each phase is demonstrated, tested, committed separately, and requires user acceptance before the next phase begins.

## Goals and success criteria

- A user with only partial material, dimension, feature, or usage information can create and confirm a product fact card without AI silently turning guesses into facts.
- The confirmed facts can generate Amazon title and five bullets or platform-neutral product copy in a selected language.
- Amazon compliance mode continues to enforce its current slots and rules.
- Universal and free modes do not inherit Amazon-only restrictions.
- User global and per-image requirements have visible, deterministic prompt precedence.
- Users can choose image count, purpose, ratio, resolution, file format, text, owned logo, watermark, and style outside hard platform constraints.
- A reference image set can be reconstructed into a newly designed set. Default behavior preserves source count and marketing-purpose correspondence; an explicit replan option permits a new structure.
- Users can select some or all of 5-10 project slots and process them through a bounded concurrent queue.
- Each project can be exported into an identifiable local folder, with ZIP fallback when directory access is unavailable.
- Every new phase has automated tests and does not regress the existing 234-test baseline or production build.

## Functional design

### Product facts assistant

Accept free-form description, structured fields, product images, target market, output language, and a list of facts AI must not infer. Produce confirmed facts, unconfirmed inferences, missing fields, contradictions, and a provisional product category. Require user confirmation before inferred information becomes authoritative.

Generate selectable copy artifacts: Amazon title, Amazon five bullets, arbitrary selling-point lists, short description, long description, independent-site copy, SEO title/keywords, and short on-image copy.

### Creation modes

- **Amazon compliance:** preserve current Listing and A+ workflows, fixed slots, module sizes, and compliance guidance.
- **Universal platform:** configurable image count and platform-neutral copy/image planning, with optional named-platform guidance added later without changing the core model.
- **Free creation:** user-directed count, purpose, composition, aspect ratio, output format, text, owned logo, watermark, and visual treatment.
- **Image-set reconstruction:** analyze a source set's marketing purposes, then redesign it using the user's facts and assets. Support light, standard, and deep-original intensity; standard is the default.

### Prompt compiler

Store prompt inputs as structured sections rather than one mutable string. Compile them in this order:

1. safety and hard selected-mode constraints;
2. global user requirements;
3. per-image user requirements;
4. confirmed product facts;
5. image goal, evidence, composition, and copy;
6. selected visual style;
7. series consistency;
8. technical output settings;
9. exclusions and negative prompt.

Show the sections and their sources before submission. Users may edit allowed sections. Conflicts must be reported rather than silently dropping a user instruction. Amazon main-image watermarks are rejected with an explanation; the same request is allowed in free mode when it uses user-owned material.

### Flexible planning

Outside Amazon mode, allow 1-12 planned images initially. Plans can be added, removed, copied, reordered, or edited. Each image owns its purpose, dimensions/ratio, resolution, file format, copy, per-image requirements, and optional style override. Natural-language requests may propose a count, but the plan is confirmed before generation when the count is ambiguous.

### Reference-set reconstruction and risk review

Analyze source images for role, marketing goal, composition, people, setting, props, copy, logos, packaging, and set-wide consistency. Retain marketing intent rather than exact visual execution.

Default output maps one-to-one to source image count and marketing roles. The replan option allows a different count and structure. Regenerate copy instead of copying it. Treat uploaded product and owned-brand assets as authoritative.

After generation, provide a similarity-risk review for detected third-party branding, copied wording, highly similar composition, people/poses, packaging, product distortion, and incorrect logo use. Label results as low risk, manual review, or high risk. Never describe the result as a legal guarantee or infringement certification.

### Batch workspace and concurrency

Provide 5-10 independent project slots with single selection, multi-selection, and select-all. Batch actions apply shared settings without overwriting slot-specific product facts, assets, or requirements.

Use a persistent bounded queue rather than unbounded threads. Initial defaults are two concurrent project analyses, two concurrent projects generating, and four image API requests globally. Make limits configurable within provider-safe bounds. Handle 429 responses with backoff and reduced concurrency. A project failure must not stop unrelated projects. Persist enough state to recover the queue after refresh without resubmitting completed work.

### Local project export

Let the user select a root directory through the File System Access API in supported Chrome/Edge environments. Create a non-overwriting directory named from date, SKU, product name, and batch number. Store source references, product assets, numbered outputs, product facts, plan, prompt history, and an HTML risk report. Fall back to one ZIP per project when directory access is unsupported or unavailable.

## Architecture boundaries

- **Product facts module:** parsing, review state, confirmation, copy artifacts, and persistence interface.
- **Mode policies:** Amazon, universal, free, and reconstruction constraints exposed through one small policy interface.
- **Planning module:** structured plans independent of API wire formats.
- **Prompt compiler:** deterministic structured input to final prompt plus conflict diagnostics.
- **Project queue:** provider-independent project/image scheduling, cancellation, retries, and recovery.
- **Export service:** directory and ZIP adapters behind one project-export interface.
- **Existing provider adapters:** remain responsible for API-specific requests, streaming, and queued-result recovery.

New behavior must not be placed wholesale into `store.ts`. Zustand may coordinate UI state, while domain operations remain testable outside React and outside the central store.

## Delivery phases and acceptance gates

0. **Specification and baseline:** glossary, ADR, design, baseline tests/build, and isolated Git commit.
1. **Product facts assistant:** demonstrate partial input, fact classification, confirmation, Amazon five bullets, and universal description.
2. **Creation mode foundation:** demonstrate that the same facts enter Amazon, universal, and free modes with isolated rules.
3. **Prompt compiler:** demonstrate visible precedence, free-mode watermark support, Amazon main-image rejection, and style override.
4. **Flexible planning:** demonstrate a four-image mixed plan, per-image settings, add/copy/delete/reorder, and confirmation.
5. **Reference-set reconstruction:** demonstrate analysis, one-to-one standard reconstruction, optional replan, and risk review.
6. **Batch queue:** demonstrate three projects, selective generation, bounded concurrency, isolated failure, retry, and refresh recovery.
7. **Local export:** demonstrate a complete project directory, stable naming, non-overwrite behavior, and ZIP fallback.
8. **Integrated acceptance:** run all automated checks and exercise the full workflow without Amazon regression.

At every gate: present the detailed design for the phase, receive approval, implement test-first, run tests/build, demonstrate behavior, commit, and stop for user acceptance.

## Test strategy

- Unit-test product fact classification, confirmation boundaries, prompt precedence/conflicts, plan editing, reconstruction mapping, risk labels, queue scheduling/backoff, and export naming.
- Add store integration tests only for coordination behavior; keep domain rules in pure modules.
- Add component tests for mode isolation, fact review, prompt preview, batch selection, progress, and recovery controls.
- Use mocked provider responses for repeatable multi-image and failure scenarios.
- Preserve all existing tests and add explicit Amazon prompt-regression fixtures before changing prompt assembly.
- Verify `npm test` and `npm run build` at every committed phase.

## Compatibility and safety assumptions

- Existing Amazon sessions, tasks, images, and settings remain readable.
- No automatic migration deletes or rewrites old IndexedDB records.
- Uploaded logos and watermarks are assumed to be user-authorized, but the UI must state that the user is responsible for usage rights.
- Similarity review reduces risk; it does not prove originality or legal clearance.
- Initial browser support for direct folder export targets Chromium File System Access API; ZIP is the compatibility fallback.
- No remote push, deployment, or production data mutation occurs without separate user authorization.

