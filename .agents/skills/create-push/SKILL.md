---
name: create-push
description: Review the current Git changes, validate the project, create a focused commit, and push it to the configured remote.
---

# Create and Push

Use this skill when the user asks to create a Git commit and push the current project changes.

## Workflow

1. Read the repository instructions from `AGENTS.md`.
2. Inspect the current branch, remote, working tree, and staged/unstaged changes.
3. Do not overwrite, reset, revert, or discard existing user changes.
4. Review the diff and identify unrelated or sensitive files. Do not commit secrets, credentials, build output, or temporary files.
5. Run the smallest relevant validation command available from the repository configuration. If validation fails, report the failure and stop before committing.
6. Stage only the files belonging to the requested change.
7. Create a concise commit message that describes the actual change.
8. Push the current branch to its configured upstream remote. Never force-push.
9. Report the commit hash, branch, remote, and validation result.

## Safety rules

- If the working tree contains unrelated changes, leave them untouched and exclude them from the commit.
- If no upstream branch is configured, report the exact command needed and stop before pushing.
- If pushing requires credentials, protected-branch approval, or a non-fast-forward update, report the reason and stop.
- Never use `git reset --hard`, `git clean`, `git checkout --`, or force-push.
