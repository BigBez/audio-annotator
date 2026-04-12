
Goal: explain why the detail-strip edit button is still failing, then outline the smallest safe fix before any code changes.

What happens today when the user clicks the label edit button
1. The user has a selected section, so the detail strip is rendered from `selectedId` in `Index.tsx`.
2. They click the label button in `SectionTimeline.tsx`:
   - Button handler fires at lines 128–132.
   - It calls `e.stopPropagation()`.
   - It calls `setEditingLabel(section.id)`.
   - It calls `setLabelValue(section.label)`.
3. Because propagation is stopped on that button, the click should not reach:
   - the detail-strip wrapper `onClick={e => e.stopPropagation()}` at line 105
   - the outer `SectionTimeline` wrapper `onClick={e => e.stopPropagation()}` at line 50
   - the page-level deselect handler in `Index.tsx` line 336

Why editing still does not appear
The session replay strongly suggests the button click is causing a re-render, but not the switch into the input state:
- each click “replaces” the pencil button with another pencil button, instead of replacing it with the input.
- that means `editingLabel === section.id` is not surviving to the render that follows the click.

The most likely reason from the current code is not the button handler itself; it is the component being re-rendered with a different `section` identity/state before the edit UI can stabilize. In this component, the detail strip is controlled by `selectedId`, and during playback `selectedId` is also being updated from `Index.tsx` by the playhead-follow effect:
- `Index.tsx` lines 84–94 recompute the active section while playing
- if that effect runs after the click, it can replace the selected section
- once `selectedId` changes, the detail strip is rebuilt for a different section or unmounted/remounted
- then `editingLabel === section.id` no longer matches the currently rendered detail row, so the button just reappears

In other words:
- the click handler is setting local edit state correctly
- but parent-driven selection updates are racing with it and replacing the rendered target before the input can remain visible

Handlers involved, in order
For a click on the detail-strip edit button:
1. Detail-strip edit button `onClick` in `SectionTimeline.tsx` lines 128–132
2. React state update queued: `setEditingLabel(section.id)`
3. Parent `Index.tsx` may independently run the playhead selection effect (lines 84–94) on the same/next render cycle if playback is active
4. `selectedId` may change from the parent
5. `SectionTimeline` re-renders with a different selected section context
6. Condition `editingLabel === section.id` fails for the now-rendered section, so the input never appears or appears too briefly to notice

Why the previous propagation-only fixes did not solve it
They addressed bubbling, but bubbling was only part of the story. The button already has `e.stopPropagation()`. If the issue were purely page-level deselection, the input should appear once that bubbling was blocked. Since the replay shows repeated button replacement instead of an input, the remaining failure is the parent selection changing underneath the detail strip.

Minimal fix to implement
Keep manual editing from being overridden by playback-driven selection while the user is interacting with the detail strip.

Smallest approach:
1. In the edit button handler, mark the selection as manual before opening edit mode.
   - This should use the existing manual-selection mechanism already present in `Index.tsx` (`manualSelectRef` via `handleSectionSelect`).
2. Ensure opening label edit does not indirectly allow the parent to switch `selectedId` during playback.
3. Keep the existing `stopPropagation()` on:
   - the detail strip wrapper
   - the edit button
   - the active input

Recommended implementation shape
- Do not introduce new structure.
- In `SectionTimeline`, when the detail-strip edit button is clicked, call `onSelectedIdChange(section.id)` before `setEditingLabel(section.id)`.
- That reuses the existing “manual selection” path in `Index.tsx`, which sets `manualSelectRef.current = true` and prevents the playhead-follow effect from immediately overriding selection on the next cycle.
- Leave the current `stopPropagation()` calls in place.
- Also add `e.stopPropagation()` inside the detail-strip label input’s `onKeyDown` for completeness, matching the timeline-block input behavior.

Files to touch
- `src/components/SectionTimeline.tsx` only

Specific changes to make
1. Detail-strip label edit button:
   - keep `e.stopPropagation()`
   - add `setSelectedId(section.id)` before `setEditingLabel(section.id)`
2. Detail-strip label input:
   - keep `onClick={e => e.stopPropagation()}`
   - add `e.stopPropagation()` in `onKeyDown`
3. Change nothing in upload, timeline blocks, JSON import, or other UI

Expected result
- Clicking the detail-strip edit button while stopped or during playback keeps the section selected
- the inline input appears immediately in the detail strip
- the existing text is auto-selected on focus
- clicks inside the input do not deselect the section
