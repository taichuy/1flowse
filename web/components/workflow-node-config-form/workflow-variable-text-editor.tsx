"use client";

import React from "react";
import { useMemo } from "react";

import {
  buildReplyVariableReference,
  formatWorkflowVariableMachineName,
  resolveReplyVariableAlias,
  type WorkflowVariableReference,
  type WorkflowVariableReferenceGroup,
  type WorkflowVariableTextDocument,
} from "@/components/workflow-node-config-form/workflow-variable-text-document";
import { WorkflowVariableReferencePicker } from "@/components/workflow-node-config-form/workflow-variable-reference-picker";

type WorkflowVariableTextEditorProps = {
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
};

type WorkflowVariableSlotsState = {
  slotTexts: string[];
  variableRefIds: string[];
};

function toSlots(document: WorkflowVariableTextDocument): WorkflowVariableSlotsState {
  const slotTexts = [""];
  const variableRefIds: string[] = [];

  document.segments.forEach((segment) => {
    if (segment.type === "text") {
      slotTexts[slotTexts.length - 1] += segment.text;
      return;
    }

    variableRefIds.push(segment.refId);
    slotTexts.push("");
  });

  return { slotTexts, variableRefIds };
}

function toDocument({
  slotTexts,
  variableRefIds,
}: WorkflowVariableSlotsState): WorkflowVariableTextDocument {
  const segments: WorkflowVariableTextDocument["segments"] = [];

  slotTexts.forEach((slotText, index) => {
    if (slotText) {
      segments.push({ type: "text", text: slotText });
    }

    if (index < variableRefIds.length) {
      segments.push({ type: "variable", refId: variableRefIds[index] });
    }
  });

  return {
    version: 1,
    segments: segments.length > 0 ? segments : [{ type: "text", text: "" }],
  };
}

function selectorsMatch(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function dropUnusedReferences({
  references,
  variableRefIds,
}: {
  references: WorkflowVariableReference[];
  variableRefIds: string[];
}) {
  const usedRefIds = new Set(variableRefIds);
  return references.filter((reference) => usedRefIds.has(reference.refId));
}

function findActivePickerSlotIndex(slotTexts: string[]) {
  for (let index = slotTexts.length - 1; index >= 0; index -= 1) {
    if (slotTexts[index]?.endsWith("/")) {
      return index;
    }
  }

  return -1;
}

export function WorkflowVariableTextEditor({
  ownerNodeId,
  ownerLabel,
  value,
  references,
  variables,
  placeholder = "输入正文，输入 / 插入变量",
  onChange,
}: WorkflowVariableTextEditorProps) {
  const { slotTexts, variableRefIds } = useMemo(() => toSlots(value), [value]);
  const referenceMap = useMemo(
    () => new Map(references.map((reference) => [reference.refId, reference])),
    [references],
  );
  const activePickerSlotIndex = useMemo(() => findActivePickerSlotIndex(slotTexts), [slotTexts]);

  const commitSlots = (nextState: WorkflowVariableSlotsState, nextReferences = references) => {
    onChange({
      document: toDocument(nextState),
      references: dropUnusedReferences({
        references: nextReferences,
        variableRefIds: nextState.variableRefIds,
      }),
    });
  };

  return (
    <div
      className="binding-field compact-stack workflow-variable-text-editor"
      data-component="workflow-variable-text-editor"
    >
      <div className="editor-json-area workflow-variable-text-editor-surface">
        {slotTexts.map((slotText, slotIndex) => (
          <div className="workflow-variable-text-editor-row" key={`slot-${slotIndex}`}>
            <textarea
              className="workflow-variable-text-slot"
              value={slotText}
              onInput={(event) => {
                const nextSlotTexts = slotTexts.slice();
                nextSlotTexts[slotIndex] = (event.target as HTMLTextAreaElement).value;
                commitSlots({ slotTexts: nextSlotTexts, variableRefIds });
              }}
              placeholder={slotIndex === 0 ? placeholder : ""}
            />
            {slotIndex < variableRefIds.length ? (
              (() => {
                const refId = variableRefIds[slotIndex];
                const reference = referenceMap.get(refId);

                if (!reference) {
                  return null;
                }

                return (
                  <div
                    className="workflow-variable-token-chip"
                    data-component="workflow-variable-token-chip"
                  >
                    <button type="button" className="sync-button">
                      [{ownerLabel}] {reference.alias}
                    </button>
                    <input
                      className="trace-text-input"
                      value={reference.alias}
                      onInput={(event) => {
                        const nextAlias = resolveReplyVariableAlias({
                          aliasBase: (event.target as HTMLInputElement).value || "value",
                          existingAliases: references
                            .filter((item) => item.refId !== refId)
                            .map((item) => item.alias),
                        });

                        onChange({
                          document: value,
                          references: references.map((item) =>
                            item.refId === refId ? { ...item, alias: nextAlias } : item,
                          ),
                        });
                      }}
                    />
                    <button
                      type="button"
                      className="sync-button secondary-button"
                      onClick={() => {
                        const nextVariableRefIds = variableRefIds.slice();
                        const nextSlotTexts = slotTexts.slice();

                        nextVariableRefIds.splice(slotIndex, 1);
                        nextSlotTexts[slotIndex] = `${nextSlotTexts[slotIndex]}${nextSlotTexts[slotIndex + 1]}`;
                        nextSlotTexts.splice(slotIndex + 1, 1);

                        commitSlots({
                          slotTexts: nextSlotTexts,
                          variableRefIds: nextVariableRefIds,
                        });
                      }}
                    >
                      删除变量
                    </button>
                  </div>
                );
              })()
            ) : null}
          </div>
        ))}
      </div>

      {activePickerSlotIndex >= 0 ? (
        <WorkflowVariableReferencePicker
          groups={variables}
          onInsert={(selector) => {
            const existingReference = references.find((reference) =>
              selectorsMatch(reference.selector, selector),
            );
            const nextReference =
              existingReference ??
              buildReplyVariableReference({
                ownerNodeId,
                aliasBase: selector.at(-1) || "value",
                selector,
                existingAliases: references.map((item) => item.alias),
              });
            const nextSlotTexts = slotTexts.slice();
            const nextVariableRefIds = variableRefIds.slice();

            nextSlotTexts[activePickerSlotIndex] = nextSlotTexts[activePickerSlotIndex].replace(
              /\/$/,
              "",
            );
            nextVariableRefIds.splice(activePickerSlotIndex, 0, nextReference.refId);
            nextSlotTexts.splice(activePickerSlotIndex + 1, 0, "");

            commitSlots(
              {
                slotTexts: nextSlotTexts,
                variableRefIds: nextVariableRefIds,
              },
              existingReference ? references : [...references, nextReference],
            );
          }}
          onCopyMachineName={(machineName) => {
            void navigator.clipboard?.writeText(machineName);
          }}
        />
      ) : (
        <small className="section-copy">
          输入 `/` 打开变量选择器，插入的变量会以当前节点内 alias 形式管理。
        </small>
      )}

      {references.length > 0 ? (
        <div className="tool-badge-row">
          {references.map((reference) => (
            <span className="event-chip" key={reference.refId}>
              {formatWorkflowVariableMachineName(reference)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
