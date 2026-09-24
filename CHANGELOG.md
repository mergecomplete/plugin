# Changelog

Every change to the plugin is recorded here. The format is [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the plugin follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The runner and the app are versioned apart from it.

## [Unreleased]

## [1.0.1] - 2026-09-24

### Changed

- Clearer messages when the plugin can't install or upgrade the runner, and the skills say the same thing about them in the same words.
- The README gives the terminal commands for installing in Claude Code, beside the slash commands.

## [1.0.0] - 2026-09-23

### Added

- The plugin, for Claude Code, Codex and Cursor. Your coding agent can ask for a review of the work it just did, read what it found, and give you the review's link.
- The **review** skill: asks for a review of finished work, before a pull request, a commit someone else will read, or saying it's done.
- The **address-the-review** skill: reads a review that's already made and goes through its risks with you, changing nothing until you agree.
- The **setup** skill: connects the runner, checks Claude Code is signed in, and offers background reviews.
- A launcher that uses the runner already on your machine, or installs it into `~/.local/bin` when there isn't one.
- On a machine the runner has no build for, every review tool answers that there's no runner for this machine, instead of the plugin failing to start.

[Unreleased]: https://github.com/mergecomplete/plugin/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/mergecomplete/plugin/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/mergecomplete/plugin/releases/tag/v1.0.0
