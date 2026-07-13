# ADR 0001: Separate creation modes behind a shared prompt compiler

## Status

Accepted

## Context

The current application is centered on Amazon Listing and A+ planning. Amazon-specific restrictions, fixed slots, style guidance, and generated prompts are closely connected. New requirements include platform-neutral copy, freely configurable image creation, reference-set reconstruction, watermarks and owned logos, flexible image counts, and concurrent projects.

Removing Amazon restrictions globally would make existing compliant workflows unreliable. Appending user requests to an already assembled prompt is also insufficient because those requests can conflict with platform rules, style guards, or negative prompts.

## Decision

Keep Amazon compliance behavior as one creation mode and add separate universal platform, free creation, and image-set reconstruction modes.

All modes share:

- a reviewed product fact card;
- a structured image plan;
- a prompt compiler with explicit precedence;
- the existing provider adapters and task history where compatible;
- project persistence and export services.

Platform-specific restrictions are supplied only by the selected mode. They are not global prompt fragments. The prompt compiler preserves this precedence:

1. safety and hard rules of the selected mode;
2. user global and per-image requirements;
3. confirmed product facts;
4. image purpose and composition;
5. visual style and series consistency;
6. technical parameters and exclusions.

## Consequences

- Amazon behavior can be regression-tested and preserved independently.
- Watermarks, owned logos, flexible layouts, and flexible counts are possible without weakening Amazon main-image constraints.
- Product facts and styles become reusable across modes.
- Existing state management must gain bounded modules rather than accumulating all new behavior in the central store.
- Historical Amazon planner sessions require backward-compatible loading.

