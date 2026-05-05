"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type SavedDraft = {
  values: Record<string, string>;
  savedAt: number;
};

function readDraft(storageKey: string): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const entry = JSON.parse(raw) as SavedDraft;
    if (Date.now() - entry.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(storageKey);
      return null;
    }
    return entry.values;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

/**
 * Persists form field values to localStorage as the user types, and restores
 * them if the user navigates away and returns before the 7-day TTL expires.
 *
 * Reads localStorage synchronously via a lazy useState initialiser so that
 * restoredDraft is available on the first render — callers can use it directly
 * in their own useState initialisers without needing a follow-up effect.
 *
 * Usage:
 *   const { formRef, restoredDraft, onFormInput, onMarkdownChange, clearDraft }
 *     = useFormDraft("draft:race:new");
 *
 *   // Attach ref to the <form> element, add onInput handler.
 *   // Pass onMarkdownChange("content") to any MarkdownEditorField onChange prop.
 *   // Call clearDraft() when the server action succeeds.
 */
export function useFormDraft(storageKey: string) {
  // Read once synchronously so callers can use restoredDraft in their own useState initialisers.
  const [restoredDraft] = useState<Record<string, string> | null>(() => readDraft(storageKey));
  const [isDirty, setIsDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Warn before tab close / hard refresh when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const form = formRef.current;
      if (!form) return;
      const values: Record<string, string> = {};
      new FormData(form).forEach((val, key) => {
        if (typeof val === "string") values[key] = val;
      });
      const entry: SavedDraft = { values, savedAt: Date.now() };
      try {
        localStorage.setItem(storageKey, JSON.stringify(entry));
      } catch {
        // localStorage unavailable or quota exceeded — fail silently
      }
    }, 500);
  }, [storageKey]);

  /** Attach to the form's onInput event to trigger auto-save on every keystroke. */
  const onFormInput = useCallback(() => {
    setIsDirty(true);
    scheduleSave();
  }, [scheduleSave]);

  /**
   * Returns a change callback for a named markdown field.
   * Pass `onMarkdownChange("content")` to MarkdownEditorField's onChange prop.
   * The hidden input is already updated by the time this fires, so FormData
   * will capture the latest markdown on the next scheduled save.
   */
  const onMarkdownChange = useCallback(
    (fieldName: string) => () => {
      void fieldName;
      setIsDirty(true);
      scheduleSave();
    },
    [scheduleSave],
  );

  /** Call this when the server action succeeds to remove the stored draft. */
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // noop
    }
    setIsDirty(false);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, [storageKey]);

  return { formRef, restoredDraft, onFormInput, onMarkdownChange, clearDraft };
}
