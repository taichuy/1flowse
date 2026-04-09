"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  buildReplyVariableReference,
  type WorkflowVariableReference,
  type WorkflowVariableReferenceGroup,
  type WorkflowVariableTextDocument,
} from "@/components/workflow-node-config-form/workflow-variable-text-document";
import { WorkflowVariableReferencePicker } from "@/components/workflow-node-config-form/workflow-variable-reference-picker";
import {
  buildReplyDocumentFromProjection,
  buildWorkflowVariableProjection,
  insertSentinelIntoProjection,
  removeTokenAfterCursor,
  removeTokenBeforeCursor,
} from "@/components/workflow-node-config-form/workflow-variable-text-projection";

type PickerMode = "slash" | "toolbar" | null;

function selectorsMatch(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function findReferenceBySelector(
  references: WorkflowVariableReference[],
  selector: string[],
) {
  return references.find((reference) => selectorsMatch(reference.selector, selector));
}

export function WorkflowVariableTextEditor({
  ownerNodeId,
  ownerLabel,
  value,
  references,
  variables,
  placeholder = "输入正文，输入 / 插入变量",
  onChange,
}: {
  ownerNodeId: string;
  ownerLabel: string;
  value: WorkflowVariableTextDocument;
  references: WorkflowVariableReference[];
  variables: WorkflowVariableReferenceGroup[];
  placeholder?: string;
  onChange: (next: {
    document: WorkflowVariableTextDocument;
    references: WorkflowVariableReference[];
  }) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [pickerTop, setPickerTop] = useState(56);
  const projection = useMemo(
    () => buildWorkflowVariableProjection({ ownerLabel, document: value, references }),
    [ownerLabel, references, value],
  );
  const tokenLabelMap = useMemo(
    () => new Map(projection.tokens.map((token) => [token.refId, token.label])),
    [projection.tokens],
  );

  const syncTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 56)}px`;
    setPickerTop(Math.min(textarea.scrollHeight + 14, 280));
  };

  useEffect(() => {
    syncTextareaHeight();
  }, [projection.text]);

  useEffect(() => {
    if (pickerMode === null && projection.text.endsWith("/")) {
      setPickerMode("slash");
    }
  }, [pickerMode, projection.text]);

  const commitProjection = (nextText: string, nextOrderedRefIds: string[], nextReferences = references) => {
    const usedRefIds = new Set(nextOrderedRefIds);
    onChange({
      document: buildReplyDocumentFromProjection({
        text: nextText,
        orderedRefIds: nextOrderedRefIds,
      }),
      references: nextReferences.filter((reference) => usedRefIds.has(reference.refId)),
    });
  };

  const resolveCurrentCursor = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return projection.text.length;
    }

    if (pickerMode === "slash" && projection.text.endsWith("/")) {
      return projection.text.length;
    }

    return textarea.selectionStart ?? projection.text.length;
  };

  const handleInsert = (selector: string[]) => {
    const existingReference = findReferenceBySelector(references, selector);
    const nextReference =
      existingReference ??
      buildReplyVariableReference({
        ownerNodeId,
        aliasBase: selector[selector.length - 1] || "value",
        selector,
        existingAliases: references.map((reference) => reference.alias),
      });
    const inserted = insertSentinelIntoProjection({
      text: projection.text,
      cursor: resolveCurrentCursor(),
      orderedRefIds: projection.orderedRefIds,
      refId: nextReference.refId,
      removeLeadingSlash: pickerMode === "slash",
    });

    commitProjection(
      inserted.text,
      inserted.orderedRefIds,
      existingReference ? references : [...references, nextReference],
    );
    setPickerMode(null);
  };

  return (
    <div
      className="workflow-variable-text-editor-shell"
      data-component="workflow-variable-text-editor"
    >
      <div
        className="workflow-variable-text-editor-toolbar"
        data-component="workflow-variable-text-editor-toolbar"
      >
        <button
          type="button"
          className="sync-button secondary-button"
          data-action="open-variable-picker"
          onClick={() => setPickerMode("toolbar")}
        >
          变量
        </button>
      </div>

      <div className="workflow-variable-text-editor-composer">
        <div className="workflow-variable-text-editor-overlay" aria-hidden="true">
          {projection.text.length === 0 && projection.tokens.length === 0 ? (
            <span className="workflow-variable-text-editor-placeholder">{placeholder}</span>
          ) : (
            value.segments.map((segment, index) =>
              segment.type === "text" ? (
                <span key={`text-${index}`}>{segment.text}</span>
              ) : (
                <span
                  key={`${segment.refId}-${index}`}
                  className="workflow-variable-inline-token"
                  data-component="workflow-variable-inline-token"
                >
                  {tokenLabelMap.get(segment.refId) ?? segment.refId}
                </span>
              ),
            )
          )}
        </div>

        <textarea
          ref={textareaRef}
          className="workflow-variable-text-editor-input"
          value={projection.text}
          onInput={(event) => {
            const textarea = event.currentTarget;
            const nextText = textarea.value;
            commitProjection(nextText, projection.orderedRefIds);

            const cursor = textarea.selectionStart ?? nextText.length;
            if (cursor > 0 && nextText[cursor - 1] === "/") {
              setPickerMode("slash");
            } else if (pickerMode === "slash") {
              setPickerMode(null);
            }
          }}
          onClick={syncTextareaHeight}
          onKeyUp={syncTextareaHeight}
          onSelect={syncTextareaHeight}
          onKeyDown={(event) => {
            const textarea = event.currentTarget;

            if (event.key === "Backspace") {
              const removed = removeTokenBeforeCursor({
                text: projection.text,
                cursor: textarea.selectionStart ?? 0,
                orderedRefIds: projection.orderedRefIds,
              });

              if (removed.text !== projection.text) {
                event.preventDefault();
                commitProjection(removed.text, removed.orderedRefIds);
                setPickerMode(null);
              }
            }

            if (event.key === "Delete") {
              const removed = removeTokenAfterCursor({
                text: projection.text,
                cursor: textarea.selectionStart ?? 0,
                orderedRefIds: projection.orderedRefIds,
              });

              if (removed.text !== projection.text) {
                event.preventDefault();
                commitProjection(removed.text, removed.orderedRefIds);
                setPickerMode(null);
              }
            }

            if (event.key === "Escape") {
              setPickerMode(null);
            }
          }}
          placeholder={placeholder}
          rows={1}
        />

        {pickerMode !== null ? (
          <div className="workflow-variable-reference-popover-anchor" style={{ top: `${pickerTop}px` }}>
            <WorkflowVariableReferencePicker groups={variables} onInsert={handleInsert} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
