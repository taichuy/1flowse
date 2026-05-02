---
memory_type: tool
tool: git
issue: "git fsck reports empty loose objects and invalid worktree branch HEAD"
created_at: "2026-05-02 09"
updated_at: "2026-05-02 09"
decision_policy: reference_on_failure
---

# Git fsck empty loose objects in linked worktree

## Failure

`git fsck --full` failed because several loose objects under `.git/objects/**` were zero bytes. The active main worktree was intact, but a linked worktree branch had:

- branch ref pointing at an empty commit object;
- linked worktree `HEAD` resolving to that bad ref;
- index cache-tree pointing at a missing tree;
- two missing blob objects whose content still existed in the linked worktree files.

## Verified repair pattern

1. Back up the affected refs, reflogs, linked worktree index, commit message, and zero-byte loose objects before changing Git metadata.
2. Map missing blobs with `git -C <worktree> ls-files --stage`.
3. Check whether worktree file contents hash to the missing blob IDs with `git hash-object <path>`.
4. Move zero-byte loose objects out of `.git/objects`, then restore recoverable blobs with `git hash-object -w <path>`.
5. Move the broken branch ref back to the last complete reflog commit using `git update-ref`.
6. Commit the staged/recovered worktree changes to create a replacement commit.
7. Rebuild stale index cache-tree with `git -C <worktree> reset --mixed HEAD`.
8. Verify with `git fsck --full --no-dangling`; plain `git fsck --full` may still print harmless dangling objects.

## Evidence

On 2026-05-02 09, this repaired `feature/runtime-event-stream-fast-debug` without touching the main worktree code. The replacement commit was created from the linked worktree files, and `git fsck --full --no-dangling` exited cleanly.
