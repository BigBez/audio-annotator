

## Fix: Increase scrollbar clearance in chord panel

**Problem**: The `pb-2` (8px) bottom padding on the scrollable chord container is not enough to prevent the horizontal scrollbar from overlapping chord content.

**Change**: In `src/components/ChordPanel.tsx`, change `pb-2` to `pb-4` (16px) on all instances of the `overflow-x-auto` container (line 348 and any other occurrences in edit mode). This gives the scrollbar more room below the chord symbols.

**Files**: `src/components/ChordPanel.tsx` only. No other changes.

