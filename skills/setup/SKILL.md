---
name: setup
description: Set up the runner that makes reviews on this machine. Connect it to the app, check Claude Code or Cursor is signed in, and offer background reviews, in that order. Use it when a review tool answers that the runner isn't connected, when the person asks to set up or check their reviews, or before the first review on a machine.
---

# Setting up the runner

The runner makes reviews on the person's machine, with their Claude or Cursor plan. Before it can, three things need to hold, and this skill checks them in order:

1. The runner is connected to the app, as the person.
2. Claude Code or Cursor is installed and signed in, since one of them writes the review.
3. Background reviews are on, or the person has chosen to leave them off.

Each step starts from the `status` tool. It takes no arguments.

## 1. Connect the runner

Call `status`.

- **"Connected to <app> as @<login>, on <machine>. ..."** The runner is connected. Go to step 2.
- **"Give the person this code and link to connect the runner: <code> at <url>. ..."** Give the person the code and the link, exactly as given. They open the link, sign in with GitHub, and approve the code. Wait until they say they've approved it, then call `status` again. While the code is waiting, `status` gives the same one. If it gives a different code, the first one expired: give the person the new code and link.
- **"The runner has a token for <app>, and the app didn't answer it: ..."** The app couldn't check the runner's token. Tell the person what it said, and call `status` again in a minute.

## 2. Check Claude Code or Cursor is signed in

Read the Claude Code and Cursor states in `status`'s answer. The review needs one of them, signed in.

- **Either is signed in:** go to step 3.
- **Installed but signed out:** offer to run its sign-in, `agent login` for Cursor or `claude` for Claude Code. It opens a browser, so the person finishes it there. Then call `status` again.
- **Neither is found:** offer to install the one the person is already working in: Cursor's agent in Cursor, Claude Code in Claude Code, and in Codex, ask which they'd like. If they agree, run its installer in a terminal or your shell tool:

  ```sh
  curl https://cursor.com/install -fsS | bash      # Cursor
  curl -fsSL https://claude.ai/install.sh | bash   # Claude Code
  ```

  Then ask them to sign in, with `agent login` for Cursor or by running `claude` once for Claude Code, and call `status` again.

Whichever agent asks for the review, Claude Code or Cursor writes it: the one the machine has, or with both, the one chosen under **Review engine** in Settings. The review uses that one's plan.

## 3. Offer background reviews

Read the background service's state in `status`'s answer.

- **On:** setup is done.
- **Off or not installed:** offer to turn background reviews on. Tell the person, before they choose:
  - With them on, a review you ask for is made in the background, outside this session, so ending the session doesn't send it back to the queue.
  - Each pull request they open on a repo the GitHub App covers, with a checkout on this machine, gets a review, on this machine with their Claude or Cursor plan. A repo the app doesn't cover yet gets one once they install the app on it: https://docs.mergecomplete.com/start/github-app/
  - Turning them on also starts reviews of up to three of their open pull requests now. Each takes about six minutes once it starts, and about $1.50 of their Claude plan, or a review's worth of their Cursor plan.

  If they agree, run this in a terminal or your shell tool:

  ```sh
  mergecomplete service install
  ```

  If the shell can't find `mergecomplete`, run it from where the runner is installed:

  ```sh
  ~/.local/bin/mergecomplete service install
  ```

  It lists the repos it covers, and why any other checkout isn't covered. Pass that on to the person. Then call `status` again to check the service reads on.

  If they'd rather not, that's their choice, and reviews still get made: a review you ask for is made in this session instead.
- **Paused:** the runner takes no new review until it's resumed. Ask the person whether to resume it. They can resume it in **Settings** in the app, or with:

  ```sh
  mergecomplete resume
  ```

## Finishing

Tell the person in a sentence or two what's set up. Then go back to what they asked for before setup, such as a review.

## When the runner can't start

- **A tool answers that there's no runner for Windows, or for this machine, yet.** The runner has no build for it. It's built for macOS and Linux. On Windows, the Linux build runs inside WSL, with the agent started inside WSL too. Tell the person that, and stop. Don't try to install anything.
- **A tool answers that the plugin couldn't install, upgrade or start the runner.** That's usually temporary, such as the app not answering. Tell the person what it said, in its own words. The plugin tries again the next time the agent starts, such as in a new session, and until then every tool gives the same answer, so don't call it again, and don't install anything by hand.
