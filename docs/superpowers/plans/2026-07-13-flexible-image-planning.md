# Flexible Image Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-proposed, manually editable, persistently stored, explicitly confirmed 1-12 image plans to Universal Platform and Free Creation without changing the Amazon Listing/A+ workflow.

**Architecture:** A pure `imageSetPlan` domain module owns plan invariants and confirmation. A separate versioned workspace persists Universal and Free plans. A provider-facing `flexiblePlannerApi` converts reviewed inputs into normalized proposals. A focused React planning workspace edits one plan and sends its selected card through the existing prompt compiler.

**Tech Stack:** TypeScript 5.8, React 19, Zustand coordination already present in the app, Vitest 4 with jsdom for native interaction tests, browser `localStorage`, existing Chat Completions/Responses profile adapters, Tailwind CSS.

## Global Constraints

- Amazon Compliance keeps its existing fixed Listing and A+ planner and prompt behavior.
- Universal and Free plans allow 1-12 cards only.
- Aspect ratios are exactly `1:1`, `4:5`, `3:4`, `16:9`, and `9:16`.
- Long-edge resolutions are exactly `1024`, `2048`, and `4096`.
- Output formats are exactly `JPEG`, `PNG`, and `WebP`.
- Every edit, add, copy, delete, reorder, mode-context change, or requirement-context change invalidates confirmation.
- AI output never overwrites confirmed product facts and must pass through normalization before persistence.
- Existing creation workspace, prompt-requirement records, Amazon sessions, settings, tasks, and images remain readable.
- Do not add a drag-and-drop dependency; Phase 4 uses explicit up/down actions.
- Each task ends with focused tests, full relevant checks, a Git commit, a GitHub push, a user-visible result, and an acceptance pause before the next task.

---

## File map

- Create `src/lib/imageSetPlan.ts`: plan types, normalization, immutable edit operations, fingerprinting, and confirmation.
- Create `src/lib/imageSetPlan.test.ts`: public domain behavior tests.
- Create `src/lib/flexiblePlanWorkspace.ts`: versioned Universal/Free plan persistence.
- Create `src/lib/flexiblePlanWorkspace.test.ts`: isolation and corrupt-data recovery tests.
- Create `src/lib/flexiblePlannerApi.ts`: strict planner request, provider call, response extraction, and normalized proposal result.
- Create `src/lib/flexiblePlannerApi.test.ts`: Chat/Responses request and parser behavior.
- Create `src/components/FlexiblePlanEditor.tsx`: plan list, selected-card editor, warnings, and confirmation UI.
- Create `src/components/FlexiblePlanEditor.test.tsx`: rendered four-card plan and public interaction behavior.
- Modify `package.json` and `package-lock.json`: add jsdom as a development-only component-test environment.
- Modify `src/components/CommerceWorkspace.tsx`: load/save plans, assemble planner request, connect selected card to prompt preview, and leave Amazon branch unchanged.
- Modify `src/components/CommerceWorkspace.test.tsx`: mode isolation, prompt integration, and Amazon regression assertions.
- Modify `src/lib/promptCompiler.test.ts`: selected flexible card priority-order fixture.

---

### Task 1: Pure image-set plan domain

**Files:**
- Create: `src/lib/imageSetPlan.ts`
- Create: `src/lib/imageSetPlan.test.ts`

**Interfaces:**
- Produces: `ImagePlanMode`, `PlannedImage`, `ImageSetPlan`, `ImagePlanProposal`, `normalizeImagePlanProposal`, `createImageSetPlan`, `addPlannedImage`, `copyPlannedImage`, `deletePlannedImage`, `movePlannedImage`, `updatePlannedImage`, `confirmImageSetPlan`, `isImageSetPlanConfirmed`.
- Consumes: no React, Zustand, browser, or provider API.

- [ ] **Step 1: Write the failing creation and normalization test**

```ts
it('normalizes a four-image mixed proposal without changing its order', () => {
  const result = normalizeImagePlanProposal({
    requestedCount: 4,
    proposal: {
      seriesStyle: 'Clean outdoor editorial set',
      images: [
        { purpose: 'Lifestyle 1', goal: 'Show commuting use', aspectRatio: '4:5', resolution: 2048, outputFormat: 'JPEG' },
        { purpose: 'Lifestyle 2', goal: 'Show weekend use', aspectRatio: '4:5', resolution: 2048, outputFormat: 'JPEG' },
        { purpose: 'Detail', goal: 'Show material texture', aspectRatio: '1:1', resolution: 4096, outputFormat: 'PNG' },
        { purpose: 'Poster', goal: 'Create a vertical hero', aspectRatio: '9:16', resolution: 2048, outputFormat: 'WebP' },
      ],
    },
    createId: (index) => `image-${index + 1}`,
  })
  expect(result.plan.images.map((image) => [image.id, image.purpose, image.aspectRatio])).toEqual([
    ['image-1', 'Lifestyle 1', '4:5'],
    ['image-2', 'Lifestyle 2', '4:5'],
    ['image-3', 'Detail', '1:1'],
    ['image-4', 'Poster', '9:16'],
  ])
  expect(result.warnings).toEqual([])
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/imageSetPlan.test.ts`

Expected: FAIL because `./imageSetPlan` does not exist.

- [ ] **Step 3: Implement types and proposal normalization**

```ts
export type ImagePlanMode = 'universal' | 'free'
export type ImageAspectRatio = '1:1' | '4:5' | '3:4' | '16:9' | '9:16'
export type ImageLongEdge = 1024 | 2048 | 4096
export type ImageOutputFormat = 'JPEG' | 'PNG' | 'WebP'

export interface PlannedImage {
  id: string
  purpose: string
  goal: string
  composition: string
  evidence: string
  copy: string
  aspectRatio: ImageAspectRatio
  resolution: ImageLongEdge
  outputFormat: ImageOutputFormat
  perImageRequirements: string
  styleOverride: string
  includeOwnedLogo: boolean
  includeOwnedWatermark: boolean
}

export interface ImageSetPlan {
  mode: ImagePlanMode
  seriesStyle: string
  images: PlannedImage[]
  selectedImageId: string | null
  warnings: string[]
  confirmationFingerprint: string | null
  confirmedAt: string | null
  updatedAt: string
}

export function createImageSetPlan(
  mode: ImagePlanMode,
  count: number,
  createId: (index: number) => string,
  now?: string,
): ImageSetPlan

export function normalizeImagePlanProposal(options: {
  requestedCount: number
  proposal: unknown
  createId: (index: number) => string
  mode?: ImagePlanMode
  now?: string
}): { plan: ImageSetPlan; warnings: string[] }
```

Normalization uses `1:1`, `2048`, and `JPEG` as safe defaults, trims strings, clamps image count to 1-12, and reports every repaired setting plus requested/proposed count mismatch.

- [ ] **Step 4: Add one failing test per immutable operation, then implement it**

```ts
const copied = copyPlannedImage(plan, 'image-2', () => 'image-copy', '2026-07-13T10:00:00.000Z')
expect(copied.images[2]).toMatchObject({ id: 'image-copy', purpose: 'Lifestyle 2 copy' })
expect(copied.confirmationFingerprint).toBeNull()

const moved = movePlannedImage(plan, 'image-4', 0, '2026-07-13T10:00:00.000Z')
expect(moved.images.map((image) => image.id)).toEqual(['image-4', 'image-1', 'image-2', 'image-3'])

const deleted = deletePlannedImage(plan, 'image-2', '2026-07-13T10:00:00.000Z')
expect(deleted.images).toHaveLength(3)
expect(() => deletePlannedImage(createImageSetPlan('free', 1, () => 'image-1'), 'image-1')).toThrow('At least one planned image is required.')
```

Implement each public operation as an immutable return value. Every mutation clears `confirmationFingerprint` and `confirmedAt`.

- [ ] **Step 5: Add confirmation fingerprint tests and implementation**

```ts
const confirmed = confirmImageSetPlan(plan, '2026-07-13T10:00:00.000Z')
expect(isImageSetPlanConfirmed(confirmed)).toBe(true)
expect(isImageSetPlanConfirmed(updatePlannedImage(confirmed, 'image-1', { copy: 'New copy' }))).toBe(false)
```

The fingerprint must deterministically include mode, series style, and all ordered user-editable card fields; it must not include `updatedAt`, `confirmedAt`, warnings, or selection.

- [ ] **Step 6: Verify and commit Task 1**

Run: `npm test -- src/lib/imageSetPlan.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: TypeScript and Vite build PASS.

Commit:

```powershell
git add src/lib/imageSetPlan.ts src/lib/imageSetPlan.test.ts
git commit -m "feat: add flexible image plan domain"
git push personal feature/multi-mode-commerce-studio
```

Stop and show the four-card normalized result plus operation tests for user acceptance.

---

### Task 2: Versioned plan persistence

**Files:**
- Create: `src/lib/flexiblePlanWorkspace.ts`
- Create: `src/lib/flexiblePlanWorkspace.test.ts`

**Interfaces:**
- Consumes: `ImageSetPlan`, `createImageSetPlan`, and normalization helpers from Task 1.
- Produces: `FlexiblePlanWorkspace`, `createEmptyFlexiblePlanWorkspace`, `loadFlexiblePlanWorkspace`, `saveFlexiblePlanWorkspace`.

- [ ] **Step 1: Write the failing mode-isolation test**

```ts
it('restores Universal and Free plans independently', () => {
  const storage = memoryStorage()
  const workspace = createEmptyFlexiblePlanWorkspace()
  workspace.universal.plan = updatePlannedImage(workspace.universal.plan, workspace.universal.plan.images[0].id, { purpose: 'Walmart hero' })
  workspace.free.plan = updatePlannedImage(workspace.free.plan, workspace.free.plan.images[0].id, { purpose: 'Free poster' })
  saveFlexiblePlanWorkspace(storage, workspace)
  const restored = loadFlexiblePlanWorkspace(storage)
  expect(restored.universal.plan.images[0].purpose).toBe('Walmart hero')
  expect(restored.free.plan.images[0].purpose).toBe('Free poster')
})
```

- [ ] **Step 2: Verify RED, then implement the storage boundary**

Run: `npm test -- src/lib/flexiblePlanWorkspace.test.ts`

Expected: FAIL because the module is missing.

```ts
const STORAGE_KEY = 'amazon-image-studio-flexible-plan-workspace-v1'

export interface FlexibleModePlanDraft {
  plan: ImageSetPlan
  plannerError: string
  isPlanning: boolean
}

export interface FlexiblePlanWorkspace {
  universal: FlexibleModePlanDraft
  free: FlexibleModePlanDraft
}
```

`loadFlexiblePlanWorkspace` must treat arrays/non-objects/corrupt JSON as empty mode drafts, normalize every loaded card through the Task 1 public normalization boundary, and never read or write Amazon session keys.

- [ ] **Step 3: Add corrupt-data and confirmation-restoration tests**

```ts
expect(loadFlexiblePlanWorkspace(memoryStorage('{bad json')).free.plan.images).toHaveLength(4)
expect(loadFlexiblePlanWorkspace(storage).universal.plan.confirmationFingerprint).toBe(savedFingerprint)
```

Persist `isPlanning` as `false` regardless of stored input so refresh never restores a phantom in-flight request.

- [ ] **Step 4: Verify and commit Task 2**

Run: `npm test -- src/lib/flexiblePlanWorkspace.test.ts src/lib/imageSetPlan.test.ts`

Expected: PASS.

Commit:

```powershell
git add src/lib/flexiblePlanWorkspace.ts src/lib/flexiblePlanWorkspace.test.ts
git commit -m "feat: persist flexible plans by mode"
git push personal feature/multi-mode-commerce-studio
```

Stop and demonstrate that mode switching restores two different plans.

---

### Task 3: AI proposal adapter and count diagnostics

**Files:**
- Create: `src/lib/flexiblePlannerApi.ts`
- Create: `src/lib/flexiblePlannerApi.test.ts`

**Interfaces:**
- Consumes: `ApiProfile`, `ImagePlanMode`, `normalizeImagePlanProposal`, existing `buildApiUrl`, `readClientDevProxyConfig`, `shouldUseApiProxy`, `createLinkedAbortController`, and `getApiErrorMessage`.
- Produces: `FlexiblePlanRequest`, `FlexiblePlanResult`, `callFlexiblePlannerApi`.

- [ ] **Step 1: Write a failing Responses API proposal test**

```ts
const result = await callFlexiblePlannerApi({
  profile: createDefaultOpenAIProfile(),
  request: {
    mode: 'free', requestedCount: 4, confirmedProductFacts: 'Material: steel',
    globalRequirements: 'Two lifestyle images, one detail, one vertical poster',
    platform: '', platformNotes: '', allowText: true, allowOwnedLogo: true,
    allowOwnedWatermark: true, language: 'US English',
  },
  createId: (index) => `generated-${index + 1}`,
})
expect(result.plan.images).toHaveLength(4)
expect(result.plan.images[3].aspectRatio).toBe('9:16')
```

Stub `fetch` with a literal Responses payload containing strict JSON under `output[0].content[0].text`.

- [ ] **Step 2: Verify RED, then implement request construction and response extraction**

Run: `npm test -- src/lib/flexiblePlannerApi.test.ts`

Expected: FAIL because the module is missing.

```ts
export interface FlexiblePlanRequest {
  mode: ImagePlanMode
  requestedCount: number
  confirmedProductFacts: string
  globalRequirements: string
  platform: string
  platformNotes: string
  allowText: boolean
  allowOwnedLogo: boolean
  allowOwnedWatermark: boolean
  language: string
}

export interface FlexiblePlanResult {
  plan: ImageSetPlan
  warnings: string[]
}
```

Use a system instruction that requires JSON `{ "seriesStyle": string, "images": PlannedImageProposal[] }`, exact requested count where unambiguous, confirmed-facts fidelity, no third-party branding, no unsupported claims, and only allowed enum values.

- [ ] **Step 3: Add Chat API, malformed JSON, repaired enum, and count-mismatch tests**

```ts
await expect(callFlexiblePlannerApi(malformedOptions)).rejects.toThrow('AI image plan was not valid JSON.')
expect(repaired.warnings).toContain('Image 1 aspect ratio was repaired to 1:1.')
expect(mismatch.warnings).toContain('Requested 4 images, but AI proposed 3. Review and confirm the final set.')
```

The adapter must retain the previous UI plan on failure by returning no partial state; the component handles the thrown error.

- [ ] **Step 4: Verify and commit Task 3**

Run: `npm test -- src/lib/flexiblePlannerApi.test.ts src/lib/imageSetPlan.test.ts`

Expected: PASS.

Commit:

```powershell
git add src/lib/flexiblePlannerApi.ts src/lib/flexiblePlannerApi.test.ts
git commit -m "feat: add flexible AI planning adapter"
git push personal feature/multi-mode-commerce-studio
```

Stop and show the normalized four-image AI fixture and count warning behavior.

---

### Task 4: Editable flexible plan workspace

**Files:**
- Create: `src/components/FlexiblePlanEditor.tsx`
- Create: `src/components/FlexiblePlanEditor.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `ImageSetPlan` and Task 1 operations.
- Produces: `FlexiblePlanEditor` React component with controlled `plan`, `onPlanChange`, `onGeneratePlan`, `isPlanning`, `plannerError`, and `compiledPrompt` props.

- [ ] **Step 1: Write the failing four-card rendering test**

```tsx
const markup = renderToStaticMarkup(
  <FlexiblePlanEditor
    mode="free"
    plan={fourImagePlan}
    onPlanChange={() => undefined}
    onGeneratePlan={() => undefined}
    isPlanning={false}
    plannerError=""
    compiledPrompt={compileImagePrompt({ mode: 'free' })}
  />,
)
expect(markup).toContain('4 张图片方案')
expect(markup).toContain('Lifestyle 1')
expect(markup).toContain('Detail')
expect(markup).toContain('9:16')
expect(markup).toContain('方案待确认')
```

- [ ] **Step 2: Verify RED, then render list, selection, warnings, and editor fields**

Run: `npm test -- src/components/FlexiblePlanEditor.test.tsx`

Expected: FAIL because the component is missing.

The component must expose accessible labels for purpose, goal, composition, evidence, image copy, ratio, resolution, format, per-image requirement, style override, owned logo, and owned watermark. Universal mode hides watermark/logo toggles unless its mode policy allows them.

- [ ] **Step 3: Add behavior tests through public controls**

Install the development-only DOM environment:

Run: `npm install --save-dev jsdom`

Use `// @vitest-environment jsdom`, a small React test harness rendered with `createRoot`, `act` from React, and native DOM events so assertions observe the controlled `onPlanChange` result:

```ts
function button(name: string) {
  return Array.from(container.querySelectorAll('button')).find((item) => item.getAttribute('aria-label') === name) as HTMLButtonElement
}

act(() => button('Copy image 2').click())
expect(latestPlan.images).toHaveLength(5)
act(() => button('Move image 5 up').click())
expect(latestPlan.images[3].id).toBe(copiedId)
const purpose = container.querySelector('[aria-label="Image purpose"]') as HTMLInputElement
act(() => {
  purpose.value = 'Close-up material detail'
  purpose.dispatchEvent(new Event('input', { bubbles: true }))
})
expect(latestPlan.confirmationFingerprint).toBeNull()
```

Also assert delete is disabled at one card and add is disabled at twelve cards.

- [ ] **Step 4: Implement actions with explicit up/down controls**

Every action calls only Task 1 public operations. Do not reproduce invariant logic inside React. Render `PromptStructurePreview` for the selected card and a confirmation button that calls `confirmImageSetPlan` through `onPlanChange`.

- [ ] **Step 5: Verify and commit Task 4**

Run: `npm test -- src/components/FlexiblePlanEditor.test.tsx src/lib/imageSetPlan.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Commit:

```powershell
git add package.json package-lock.json src/components/FlexiblePlanEditor.tsx src/components/FlexiblePlanEditor.test.tsx
git commit -m "feat: add editable flexible plan workspace"
git push personal feature/multi-mode-commerce-studio
```

Stop and show the four-card editor with add/copy/delete/reorder controls.

---

### Task 5: Commerce workspace, AI, persistence, and prompt integration

**Files:**
- Modify: `src/components/CommerceWorkspace.tsx`
- Modify: `src/components/CommerceWorkspace.test.tsx`
- Modify: `src/lib/promptCompiler.test.ts`

**Interfaces:**
- Consumes: Tasks 1-4 plus existing `getAmazonPlannerProfile`, confirmed product facts, creation workspace, prompt requirements, and `compileImagePrompt`.
- Produces: complete Universal/Free workflow with independent persisted plans and selected-card prompt previews.

- [ ] **Step 1: Write the failing selected-card compiler fixture**

```ts
const compiled = compileImagePrompt({
  mode: 'free',
  globalRequirements: 'Create a coherent four-image set.',
  perImageRequirements: 'Use my owned watermark in the lower right.',
  confirmedProductFacts: 'Material: stainless steel',
  imageGoal: 'Vertical poster for mobile.',
  compositionAndCopy: 'Centered product; headline: BUILT FOR THE COMMUTE',
  visualStyle: 'Cool blue editorial lighting.',
  seriesConsistency: 'Keep the same product finish across all four images.',
  technicalRequirements: '9:16; 2048 long edge; WebP.',
})
expect(compiled.sections.map((section) => section.kind)).toEqual([
  'mode-rules', 'global-requirements', 'per-image-requirements', 'product-facts',
  'image-goal', 'composition-copy', 'visual-style', 'series-consistency', 'technical',
])
expect(compiled.canSubmit).toBe(true)
```

- [ ] **Step 2: Add failing CommerceWorkspace mode-isolation assertions**

Render Universal and Free branches with injected persisted fixtures or exported pure assembly helpers. Assert Universal shows `Walmart hero`, Free shows `Vertical poster`, and neither fixture appears in the Amazon branch.

- [ ] **Step 3: Load and save the flexible workspace in CommerceWorkspace**

Add one `useState<FlexiblePlanWorkspace>` initialized by `loadFlexiblePlanWorkspace`, one persistence `useEffect`, and mode-specific update callbacks. Do not add plan state to central `store.ts`.

- [ ] **Step 4: Assemble the selected-card compiler input**

```ts
function compileFlexibleCard(options: {
  mode: 'universal' | 'free'
  plan: ImageSetPlan
  selected: PlannedImage
  globalRequirements: string
  confirmedProductFacts: string
}) {
  return compileImagePrompt({
    mode: options.mode,
    globalRequirements: options.globalRequirements,
    perImageRequirements: options.selected.perImageRequirements,
    confirmedProductFacts: options.confirmedProductFacts,
    imageGoal: `${options.selected.purpose}\n${options.selected.goal}`,
    compositionAndCopy: [options.selected.composition, options.selected.evidence, options.selected.copy].filter(Boolean).join('\n'),
    visualStyle: options.selected.styleOverride,
    seriesConsistency: options.plan.seriesStyle,
    technicalRequirements: `${options.selected.aspectRatio}; ${options.selected.resolution} long edge; ${options.selected.outputFormat}.`,
  })
}
```

Expose this helper from a focused module if direct component testing would otherwise couple tests to React internals.

- [ ] **Step 5: Connect Generate image plan**

Build `FlexiblePlanRequest` from reviewed facts, current mode, requested count, global requirement, Universal platform notes or Free permissions, and `US English`. On success replace only the active mode plan. On failure keep the previous plan and set a visible retryable error. Set `isPlanning` only for the active mode and always clear it in `finally`.

- [ ] **Step 6: Invalidate confirmation on context change**

When global requirement, target platform/notes, Free permission toggles, or confirmed product facts change, clear the active plan's confirmation fields without altering cards. Selection changes alone must not invalidate confirmation.

- [ ] **Step 7: Verify and commit Task 5**

Run:

```powershell
npm test -- src/components/CommerceWorkspace.test.tsx src/components/FlexiblePlanEditor.test.tsx src/lib/promptCompiler.test.ts src/lib/flexiblePlannerApi.test.ts src/lib/flexiblePlanWorkspace.test.ts src/lib/imageSetPlan.test.ts
```

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Commit:

```powershell
git add src/components/CommerceWorkspace.tsx src/components/CommerceWorkspace.test.tsx src/lib/promptCompiler.test.ts
git commit -m "feat: connect flexible planning workflow"
git push personal feature/multi-mode-commerce-studio
```

Stop and demonstrate AI proposal, card editing, selected-card prompt preview, persistence, and re-confirmation after an edit.

---

### Task 6: Phase 4 regression, review, and acceptance evidence

**Files:**
- Modify only files required by concrete review findings.
- Create: `docs/verification/phase-4-flexible-planning.md`

**Interfaces:**
- Consumes: the completed Phase 4 public workflow.
- Produces: final verification record and review fixes.

- [ ] **Step 1: Run all automated checks**

Run: `npm test`

Expected: all test files pass with zero failures.

Run: `npm run build`

Expected: TypeScript and Vite production build pass. The existing bundle-size warning is non-blocking unless Phase 4 materially increases it beyond the current baseline.

Run: `git diff --check HEAD~5...HEAD`

Expected: no whitespace errors.

- [ ] **Step 2: Invoke the code-review skill against the Phase 4 starting commit**

Use fixed point `99fee2d` and the design file `docs/superpowers/specs/2026-07-13-flexible-image-planning-design.md`. Run separate Standards and Spec reviews. Fix every hard violation and every acceptance-impacting spec gap, then rerun focused tests and build.

- [ ] **Step 3: Capture acceptance evidence**

Record in `docs/verification/phase-4-flexible-planning.md`:

```md
# Phase 4 verification

- Four-card mixed plan: pass
- Add/copy/delete/reorder/edit: pass
- Universal/Free persistence isolation: pass
- Confirmation invalidates after edit: pass
- Selected-card structured prompt preview: pass
- Amazon Listing/A+ regression: pass
- Full tests: record the numeric Vitest total printed by the completed `npm test` run
- Production build: pass
```

Capture a local screenshot showing four cards, different ratios, selected-card editor, and confirmation status.

- [ ] **Step 4: Commit and push verification fixes**

```powershell
git add package.json package-lock.json src/lib/imageSetPlan.ts src/lib/imageSetPlan.test.ts src/lib/flexiblePlanWorkspace.ts src/lib/flexiblePlanWorkspace.test.ts src/lib/flexiblePlannerApi.ts src/lib/flexiblePlannerApi.test.ts src/components/FlexiblePlanEditor.tsx src/components/FlexiblePlanEditor.test.tsx src/components/CommerceWorkspace.tsx src/components/CommerceWorkspace.test.tsx src/lib/promptCompiler.test.ts docs/verification/phase-4-flexible-planning.md
git commit -m "test: verify flexible image planning phase"
git push personal feature/multi-mode-commerce-studio
```

- [ ] **Step 5: Stop for Phase 4 acceptance**

Report commit IDs, full test count, build result, screenshot, fixed review findings, and exact user-visible capabilities. Do not begin Phase 5 until the user explicitly confirms.
