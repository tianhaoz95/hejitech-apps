---
name: heji-new-skill
description: The standard for adding a skill to this HEJI monorepo -- always a project skill in .claude/skills/heji-<name>/ (never user-level or global), named with the heji- prefix, then symlinked into .agents/skills/ for Codex, Antigravity, Gemini CLI, Cursor and other agents, and listed in README.md. Use whenever the user asks to add, create, write or make a new skill, or to rename or remove one.
---

# Add a new skill

"Add a new skill" always means a **project skill in this repo**. No exceptions: never put it in
`~/.claude/skills/`, a plugin, or anywhere else outside the repo, even if the skill looks generic.

## Rules

1. **Location.** The skill lives in `.claude/skills/heji-<name>/SKILL.md` (plus any scripts or
   templates it needs, in the same folder). That folder is the only real copy.
2. **Symlink for other agents.** Right after creating it, link it from `.agents/skills/` so Codex,
   Antigravity, Gemini CLI, Cursor and other agents see the same skill:
   ```sh
   ln -s ../../.claude/skills/heji-<name> .agents/skills/heji-<name>
   ```
   Never copy the folder there; never create the skill in `.agents/skills/` first.
3. **`heji-` prefix.** Every project skill's folder, symlink and frontmatter `name:` start with
   `heji-` (`heji-fix-ci`, not `fix-ci`), so typing `/heji-` lists the repo's own skills first. If
   the user gives a name without it, add it.

## Steps

1. Pick a short kebab-case name: `heji-<what-it-does>`.
2. Write `.claude/skills/heji-<name>/SKILL.md`:
   ```markdown
   ---
   name: heji-<name>
   description: <what it does, then "Use when …" with the phrases the user would actually say>
   ---

   # <Title>
   …
   ```
   Paths inside the skill are repo-relative (`.claude/skills/heji-<name>/script.sh`). Keep it
   about the whole repo's conventions; a project-specific skill still lives here, and says which
   `projects/<name>/` it is for.
3. Make any helper scripts executable (`chmod +x`).
4. Create the symlink (rule 2) and check it resolves: `test -f .agents/skills/heji-<name>/SKILL.md`.
5. Add the skill to the `.claude/skills/` line of the `README.md` layout.
6. Grep for anything that should mention it (other skills, `CLAUDE.md` files).

## Renaming or removing

Rename with `git mv .claude/skills/<old> .claude/skills/heji-<new>`, update `name:`, replace the
symlink (`git rm .agents/skills/<old>` then step 4), and update every reference
(`git grep -n '<old>'`: other skills' text, `new.sh`-style usage lines, `README.md`). Removing a
skill removes both the folder and its symlink, plus its `README.md` mention.

## Check before finishing

```sh
for l in .agents/skills/*; do test -f "$l/SKILL.md" || echo "broken: $l"; done
ls .claude/skills | grep -v '^heji-'                    # should print nothing
grep -h '^name:' .claude/skills/*/SKILL.md | grep -v 'name: heji-'   # should print nothing
```
