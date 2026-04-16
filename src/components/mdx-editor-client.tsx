"use client";

import { useCallback, useMemo } from "react";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  MDXEditor,
  markdownShortcutPlugin,
  quotePlugin,
  Separator,
  InsertTable,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
} from "@mdxeditor/editor";

type MdxEditorClientProps = {
  markdown: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function isSafeEditorUrl(value: string): boolean {
  const url = value.trim();

  if (!url) {
    return false;
  }

  // Block script-like URLs but allow standard markdown link targets
  return !/^(javascript|vbscript|data):/i.test(url);
}

function normalizeLinkTarget(target: string): string {
  const trimmed = target.trim();
  const hasAngleBrackets = trimmed.startsWith("<") && trimmed.endsWith(">") && trimmed.length > 2;
  const rawTarget = hasAngleBrackets ? trimmed.slice(1, -1) : trimmed;

  if (!rawTarget) {
    return target;
  }

  if (
    rawTarget.startsWith("#") ||
    rawTarget.startsWith("/") ||
    rawTarget.startsWith("./") ||
    rawTarget.startsWith("../") ||
    rawTarget.startsWith("?") ||
    /^[a-z][a-z0-9+.-]*:/i.test(rawTarget)
  ) {
    return target;
  }

  const domainLikePattern = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/:?#].*)?$/i;
  if (!domainLikePattern.test(rawTarget)) {
    return target;
  }

  const normalizedTarget = `https://${rawTarget}`;
  return hasAngleBrackets ? `<${normalizedTarget}>` : normalizedTarget;
}

function normalizeMarkdownLinks(markdown: string): string {
  return markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (fullMatch, text, rawDestination) => {
    const destination = String(rawDestination).trim();
    const destinationMatch = destination.match(/^(<[^>]+>|[^\s]+)(\s+.*)?$/);

    if (!destinationMatch) {
      return fullMatch;
    }

    const target = destinationMatch[1];
    const suffix = destinationMatch[2] ?? "";
    const normalizedTarget = normalizeLinkTarget(target);

    if (normalizedTarget === target) {
      return fullMatch;
    }

    return `[${text}](${normalizedTarget}${suffix})`;
  });
}

export function MdxEditorClient({ markdown, onChange, placeholder }: MdxEditorClientProps) {
  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      tablePlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      linkPlugin({ validateUrl: isSafeEditorUrl }),
      linkDialogPlugin(),
      markdownShortcutPlugin(),
      toolbarPlugin({
        toolbarClassName: "shr-mdxeditor-toolbar",
        toolbarContents: () => (
          <>
            <UndoRedo />
            <Separator />
            <BlockTypeSelect />
            <Separator />
            <BoldItalicUnderlineToggles />
            <Separator />
            <ListsToggle options={["bullet", "number"]} />
            <Separator />
            <InsertTable />
            <Separator />
            <CreateLink />
          </>
        ),
      }),
    ],
    []
  );

  const handleChange = useCallback(
    (nextMarkdown: string) => {
      onChange(normalizeMarkdownLinks(nextMarkdown));
    },
    [onChange]
  );

  return (
    <div className="rounded-xl border border-stone-300 bg-stone-50 px-3 py-3">
      <MDXEditor
        markdown={markdown}
        onChange={handleChange}
        placeholder={placeholder}
        className="shr-mdxeditor light-theme text-stone-900"
        contentEditableClassName="shr-mdxeditor-content min-h-[22rem] px-2 py-2 text-base leading-7 text-stone-900"
        plugins={plugins}
      />
    </div>
  );
}
