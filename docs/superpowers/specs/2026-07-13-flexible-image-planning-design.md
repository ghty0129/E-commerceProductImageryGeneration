# Flexible image planning design

## Scope

Phase 4 adds flexible, editable image-set planning to Universal Platform and Free Creation modes. Amazon Compliance keeps its existing fixed Listing and A+ planner.

The user can describe a desired set in natural language, for example: “Create four images: two lifestyle scenes, one detail image, and one vertical poster.” AI proposes a structured plan, the user edits it, and generation remains unavailable until the complete set is explicitly confirmed.

This phase does not add reference-set reconstruction, batch project concurrency, local-folder export, or similarity-risk review. Those remain in later phases.

## User workflow

1. Select Universal Platform or Free Creation.
2. Enter the whole-set requirement, target platform details where relevant, and a desired image count from 1 to 12.
3. Select **Generate image plan**. The planner uses confirmed product facts, mode policy, global requirements, target platform notes, allowed owned assets, and desired count.
4. Review the proposed image cards. Each card clearly displays its purpose, composition, copy, technical settings, style direction, and per-image requirement.
5. Add, copy, delete, move, or edit cards. The displayed count always follows the actual card list.
6. Select **Confirm complete plan**. Confirmation records the current plan fingerprint.
7. Any later change invalidates confirmation. The user must confirm again before the plan can be used for generation.

If the natural-language request and numeric image count disagree, the planner returns the proposed count and a visible warning. The editor does not silently create more than 12 or fewer than 1 image. The user resolves the ambiguity by editing the cards and confirming the resulting list.

## Plan model

The domain module exposes an `ImageSetPlan` independent of React, Zustand, and provider request formats.

Each `PlannedImage` owns:

- stable local ID and display order;
- purpose and image goal;
- composition and visual evidence to preserve;
- optional on-image copy;
- aspect ratio;
- resolution;
- output format;
- per-image requirements;
- optional visual-style override;
- optional owned-logo and owned-watermark intent where the selected mode permits them.

The set owns:

- mode (`universal` or `free`);
- planner status and last planner warning;
- set-wide style/consistency direction;
- ordered image cards;
- confirmation fingerprint and confirmation time;
- last-updated time.

Allowed initial aspect ratios are `1:1`, `4:5`, `3:4`, `16:9`, and `9:16`. Allowed resolutions are `1024`, `2048`, and `4096` on the long edge. Allowed formats are `JPEG`, `PNG`, and `WebP`. Unsupported planner output is normalized to safe defaults and surfaced as a warning rather than trusted directly.

## Domain operations

The planning module provides pure public operations:

- create an empty plan with a requested count;
- normalize an AI proposal;
- add a card;
- copy a card with a new ID;
- delete a card while preserving the minimum of one;
- move a card by one position or to a target index;
- update one card;
- confirm the current plan;
- determine whether the current plan still matches its confirmation fingerprint.

All mutation operations return a new plan and invalidate confirmation. IDs are supplied through a small ID factory argument so tests remain deterministic.

## AI planning boundary

The AI boundary accepts a `FlexiblePlanRequest` containing only reviewed inputs:

- selected mode and its policy;
- requested count;
- confirmed product facts;
- global requirement;
- target platform and notes for Universal Platform;
- text, owned-logo, and owned-watermark permissions for Free Creation;
- output language.

The system prompt requests strict JSON with one plan entry per proposed image. It explicitly forbids changing confirmed product facts and forbids third-party logos, copied marketplace badges, prices, ratings, and unsupported claims.

The response parser validates JSON, normalizes enum-like settings, limits the result to 1-12 cards, creates stable local IDs, and returns warnings for count mismatch or repaired fields. Raw provider output never becomes persisted plan state without normalization.

Phase 4 uses the existing AI-planning API profile and provider adapter pattern. Image generation itself continues through the existing prompt/task path; Phase 4's acceptance gate covers preparing and confirming flexible plans, not multi-project batch submission.

## Prompt integration

For the currently selected image card, the existing shared prompt compiler receives:

1. selected-mode rules;
2. global requirement;
3. the card's per-image requirement;
4. confirmed product facts;
5. card purpose, goal, composition, and copy;
6. card style override or set-wide style;
7. series consistency;
8. aspect ratio, resolution, and output format;
9. exclusions.

The structured preview updates immediately while editing. Free Creation may include user-owned logo or watermark requests with the existing rights reminder. Universal Platform applies named-platform notes but does not inherit Amazon-only fixed slots.

## Interface design

The existing Universal/Free foundation panel gains a planning workspace below the set requirements:

- header with requested count, actual card count, planner status, and **Generate image plan**;
- compact warning area for ambiguous counts or repaired AI output;
- ordered card list with visible image number and purpose;
- card actions: edit, copy, move up, move down, delete;
- **Add image** action, disabled at 12 cards;
- editor panel for the selected card's fields;
- structured prompt preview for the selected card;
- sticky confirmation area showing either **Plan needs confirmation** or **Plan confirmed**.

Reordering uses explicit up/down controls in Phase 4. This avoids adding a drag-and-drop dependency and remains usable on touch devices and with a keyboard. Drag-and-drop can be added later without changing the domain operations.

## Persistence and compatibility

Flexible plans use a dedicated versioned local-storage workspace with separate Universal and Free drafts. Loading tolerates missing, corrupt, and older data. Existing creation-mode and prompt-requirement records remain readable and are not deleted or rewritten.

Switching modes preserves each mode's selected card, plan, warnings, and confirmation independently. Product facts remain shared.

## Errors and safety

- Missing or invalid AI profile: show the existing settings route and keep manual plan editing available.
- AI parse failure: retain the previous plan and show a retryable error.
- Count mismatch: show a warning and require explicit confirmation; never silently override the numeric input.
- Delete at one card: reject the operation with a visible explanation.
- Add at twelve cards: disable the action.
- Mode or requirement change: invalidate confirmation because the compiled plan context changed.
- Owned logo/watermark: keep the existing authorization reminder.
- Confirmed product facts: remain higher priority than plan content and cannot be overwritten by the AI proposal.

## Public test seams

The agreed seams for TDD are:

1. `imageSetPlan` domain API: create, normalize, add, copy, delete, reorder, update, confirm, and confirmation invalidation.
2. `flexiblePlannerApi` parser boundary: valid proposal, count mismatch, repaired settings, malformed response, and 1-12 limits.
3. Prompt integration: a selected card compiles its per-image requirement, composition/copy, style, and technical settings in the established priority order.
4. Flexible planning component: a four-image mixed plan renders; copy/delete/reorder/edit actions update visible state; confirmation disables after an edit.
5. Persistence boundary: Universal and Free plans restore independently without changing existing Amazon data.

Tests observe these public behaviors rather than private React state or internal helper calls.

## Acceptance criteria

- A natural-language four-image request produces a normalized four-card proposal.
- The cards can represent two lifestyle images, one detail image, and one vertical poster with different ratios and copy settings.
- The user can add, copy, delete, reorder, and edit cards without leaving the mode.
- Actual card count always matches the plan shown to the user.
- Universal and Free plans persist independently.
- The selected card appears in the shared structured prompt preview with its own requirements and technical settings.
- The complete plan must be confirmed before generation; any edit invalidates confirmation.
- Existing Amazon Listing/A+ behavior and prompts remain unchanged.
- The full automated test suite and production build pass.
