

## Problem

The BarCountLayer renders but is visually invisible because:
1. **Gap**: The parent `main` element uses `space-y-6` (24px gap), which separates the BarCountLayer from the SectionTimeline above it. They should be flush against each other.
2. **No visual presence**: Empty cells have no background or border, making the 24px strip invisible until values are entered.

## Plan

**File: `src/pages/Index.tsx`**

Wrap `SectionTimeline` and `BarCountLayer` together in a single `<div>` (no gap) so they render as one visual unit, eliminating the `space-y-6` gap between them.

```tsx
{duration > 0 && (
  <div>
    <SectionTimeline ... />
    {sections.length > 0 && (
      <BarCountLayer ... />
    )}
  </div>
)}
```

**File: `src/components/BarCountLayer.tsx`**

Add a subtle background color to the strip so it's visible even when no bar counts are entered (e.g., `bg-muted/30`), making cells clickable and discoverable.

