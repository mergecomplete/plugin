# mergecomplete for your coding agent

This plugin lets your coding agent ask for a review of the work it just did. The review explains the change so the next person can follow it quickly, and flags what's risky before they read it. Your agent reads what it found, weighs it, and gives you the review's link.

It installs in Claude Code, Codex and Cursor. The review itself is made by the mergecomplete runner, on your machine and your Claude plan.

## What it adds to your agent

- **Three skills,** which tell the agent when and how to use the review tools:
  - **review:** asks for a review of finished work, before a pull request, a commit someone else will read, or saying it's done. Not after every edit.
  - **address-the-review:** reads a review that's already made and goes through its risks with you. It changes nothing until you agree.
  - **setup:** connects the runner, checks Claude Code is signed in, and offers background reviews.
- **The review tools,** served by the runner over MCP: ask for a review, wait for it, read one, list what can be reviewed, and check the setup.

In Claude Code the skills are also slash commands: `/mergecomplete:review`, `/mergecomplete:address-the-review` and `/mergecomplete:setup`.

## Installing it

### Claude Code

Add this repository as a marketplace, then install the plugin from it:

```text
/plugin marketplace add mergecomplete/plugin
/plugin install mergecomplete@mergecomplete
```

### Codex

Add this repository as a marketplace, then install the plugin from it:

```sh
codex plugin marketplace add mergecomplete/plugin
codex plugin add mergecomplete@mergecomplete
```

### Cursor

Clone this repository into Cursor's local plugins:

```sh
git clone https://github.com/mergecomplete/plugin ~/.cursor/plugins/local/mergecomplete
```

Then run **Developer: Reload Window** from the command palette. The plugin is coming to the Cursor Marketplace.

## What installing it puts on your machine

The plugin installs nothing until your agent first starts it, and then only the runner, the same one the website's install command gives you.

The plugin is this repository: its manifests, the three skills and a launcher script. It holds no product code. When your agent starts it, the launcher:

1. Looks for the runner on your `PATH`, then in `~/.local/bin`. If it finds one, it uses it and installs nothing.
2. Otherwise installs the runner into `~/.local/bin/mergecomplete` from [app.mergecomplete.com](https://app.mergecomplete.com), checked the same way the install script checks it ([What the install script does](https://docs.mergecomplete.com/start/install/#what-the-install-script-does)). It says what it installed, and where, in your agent's MCP log.

Installing the runner doesn't connect it or turn on background reviews. The setup skill does both, with you.

After that, each time your agent starts the plugin, the launcher upgrades the runner in the background to the build the app serves, as `mergecomplete review` does in a terminal, unless `MERGECOMPLETE_AUTO_UPDATE=0` pins it. The agent carries on with the runner it started, and its next start runs the new one. One runner serves the plugin, the `mergecomplete` command and background reviews, so `mergecomplete status` in a terminal shows the same connection your agent uses.

## Setting it up

Ask your agent to set up mergecomplete, or run `/mergecomplete:setup` in Claude Code. The agent does the checking, and asks you for what only you can do:

1. It gives you a code and a link. Open the link, sign in with GitHub, approve the code, and tell the agent you've approved it.
2. It checks Claude Code is installed and signed in, since Claude Code writes the review.
3. It offers background reviews. With them on, a review your agent asks for is made outside its session, and each pull request you open on a repo the [GitHub App](https://docs.mergecomplete.com/start/github-app/) covers gets a review. You can say no, and your agent's reviews are then made in its session.

When a review tool answers that the runner isn't connected, the agent runs setup by itself.

## Asking for a review

Ask in your own words: "review what you've done", "review #87", "what did the review of this branch find?". With nothing named, the agent reviews the work in progress: your uncommitted files and the branch's commits since its base.

The agent also asks for a review by itself when a piece of work is finished, before a pull request or before telling you it's done. It gives you the review's link and what it made of each risk. The findings are a reviewer's, and the agent weighs them rather than following them.

## What a review costs

A review runs on your machine, on the Claude plan you already have. It takes about six minutes once it starts, and about $1.50 of your plan. That figure is what the tokens would cost at API list prices, the number to hold against your plan's allowance. Nobody bills it ([What a review costs](https://docs.mergecomplete.com/making/cost/)). The budget you set in **Settings** applies to each review.

In Codex and Cursor too, Claude Code makes the review and your Claude plan pays for it, not your Codex or Cursor plan. Claude Code needs to be installed and signed in on the machine.

## When there's no runner for your machine

The runner is built for macOS and Linux, on arm64 and x86_64. There's no Windows build yet. On Windows the plugin still starts, and every review tool answers that there's no runner for this machine, so your agent can tell you instead of failing.

On Windows, the Linux build runs inside WSL. Run your agent inside WSL, and the plugin installs and uses it there.

## Updating it

The runner updates itself. The plugin changes only when a skill or a manifest does, and [CHANGELOG.md](CHANGELOG.md) says what changed. In Claude Code, refresh the marketplace to get a new version:

```text
/plugin marketplace update mergecomplete
```

## Adding the tools without the plugin

Any MCP client can start the runner's tools directly, as `mergecomplete mcp`, with no skills. [Reviewing from your coding agent](https://docs.mergecomplete.com/making/from-your-agent/) covers adding it by hand, and everything a review from your agent does.
