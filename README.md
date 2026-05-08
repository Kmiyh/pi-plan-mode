# @kmiyh/pi-plan-mode

`@kmiyh/pi-plan-mode` is a Pi extension that adds a read-only exploration mode for safe code analysis, planning, and tracked execution.

It is packaged from Pi's `examples/extensions/plan-mode` extension.

## Features

- **Read-only tools**: restricts available tools to `read`, `bash`, `grep`, `find`, `ls`, and `questionnaire`
- **Bash allowlist**: only read-only bash commands are allowed while plan mode is enabled
- **Plan extraction**: extracts numbered steps from `Plan:` sections
- **Progress tracking**: shows a widget with completion status during execution
- **`[DONE:n]` markers**: tracks explicit step completion tags from assistant responses
- **Session persistence**: state survives session resume and reloads

## Installation

```bash
pi install npm:@kmiyh/pi-plan-mode
```

Or install directly from GitHub:

```bash
pi install git:github.com/Kmiyh/pi-plan-mode
```

## Commands

- `/plan` - toggle plan mode
- `/todos` - show current plan progress
- `Ctrl+Alt+P` - toggle plan mode shortcut

## Usage

1. Enable plan mode with `/plan` or start Pi with `--plan`.
2. Ask the agent to analyze code and create a plan.
3. The agent should output a numbered plan under a `Plan:` header:

```text
Plan:
1. First step description
2. Second step description
3. Third step description
```

4. Choose **Execute the plan** when prompted.
5. During execution, the agent marks steps complete with `[DONE:n]` tags.
6. The progress widget shows completion status.

## How it works

### Plan mode (read-only)

- Only read-only tools are available.
- Bash commands are filtered through an allowlist.
- The agent creates a plan without making changes.

### Execution mode

- Full tool access is restored.
- The agent executes steps in order.
- `[DONE:n]` markers track completion.
- A widget shows progress.

### Command allowlist

Safe commands include:

- file inspection: `cat`, `head`, `tail`, `less`, `more`
- search: `grep`, `find`, `rg`, `fd`
- directory: `ls`, `pwd`, `tree`
- Git read-only commands: `git status`, `git log`, `git diff`, `git branch`
- package info: `npm list`, `npm outdated`, `yarn info`
- system info: `uname`, `whoami`, `date`, `uptime`

Blocked commands include:

- file modification: `rm`, `mv`, `cp`, `mkdir`, `touch`
- Git write commands: `git add`, `git commit`, `git push`
- package installs: `npm install`, `yarn add`, `pip install`
- system commands: `sudo`, `kill`, `reboot`
- editors: `vim`, `nano`, `code`

## Local development

```bash
npm install
npm run typecheck
pi -e ./src/index.ts
```

## License

MIT
