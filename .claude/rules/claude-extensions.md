---
paths:
  - '.claude/{mods,plugins,skills,agents}/**'
---

# Skills, Plugins and Mods

- Namespace every slash command a plugin or mod ships as `<plugin>:<verb>`, with a short kebab-case verb (`agent-dock:toggle`, `feedback-loop:install`). The prefix keeps commands from colliding and shows where a command comes from
- Declare each command as a `commands/<verb>.md` stub with `description`, plus `argument-hint` if it takes arguments. A mod answers it in a `command.run` hook matching the full `<plugin>:<verb>` name. Don't register commands at runtime with `$.command.register`. The stub is the one declaration
- Name a plugin's skill by the verb a person does with it, like a command (`docs-review:check`), not by repeating the plugin's name. The same goes for each thing a mod offers: `install`, `open`, `toggle`
