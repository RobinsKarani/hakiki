# Competition readiness

Checked against the [Governance brief](https://agentic-africa-challenge.lovable.app/tracks/governance). The synthetic review works with OpenAI and Gemini, but several submission requirements are still incomplete or unconfirmed.

Your submission target is **14 October 2026, evening, Africa/Nairobi**. This is your target, not a verified organizer cutoff. The brief's header says 15 October, while its submission-period rules still say TBC; the exact deadline and timezone remain unclear. Organizer contact and submission are left to you.

| Requirement | Current state |
| --- | --- |
| Own MCP server, three tools, actual action | IMPLEMENTED: checks model-proposed requirements and evidence, then writes a draft. |
| Independent third-party MCP | IMPLEMENTED: Filesystem MCP reads selected files with directory restrictions. |
| Open-source orchestration or equivalent | IMPLEMENTED: MIT loop. Organizer acceptance UNCONFIRMED. |
| Full open-weight task | **INCOMPLETE**: Groq/Gemma attempts failed. OpenAI and Gemini runs do not meet this requirement. Hosted inference acceptance is UNCONFIRMED. |
| Timestamped action inputs/outputs | IMPLEMENTED: agent/MCP logs shown in the browser. File import is setup, not a model tool call. |
| Named human gate | IMPLEMENTED: completed, unchanged drafts require a name and note. Identity is self-reported; no officer has reviewed a report. |
| New work in submission window | UNCONFIRMED: work recorded 12 October 2026; eligible dates/timezone need confirmation. |
| Public OSI repository / one-command setup | IMPLEMENTED: [public repository](https://github.com/RobinsKarani/procurement-review-agent), MIT license and locked setup. Clean-copy startup tested. |
| Public unedited video under three minutes | PARTIAL: fresh local 63.56-second Gemini recording, without edits, audio or human approval. Not uploaded to YouTube/Vimeo. |
| About 300 words / office / workflow / theme | DRAFTED in [application.md](application.md). Intended user identified; no institutional partnership. |
| One-page architecture / diagram | PREPARED: [ARCHITECTURE.md](../ARCHITECTURE.md), PNG and SVG below 10 MB. |
| EVALS with 8+ tasks, pass/fail and unresolved issue | COMPLETED LOCALLY: eight distinct live tasks on one runtime, 4 PASS / 4 FAIL, plus an Amani repetition. Citation coverage and unfamiliar-notice extraction remain unreliable. |
| Open/synthetic data, no active tender or personal details | Included packages use synthetic data or a closed notice with contacts removed. Custom input needs review. |

The model plans, selects tools and can correct failed calls. Reports retain source quotations and logs. No procurement officer has tested the workflow, and no time saving has been measured.

Before submission:

1. Confirm MIT orchestration, hosted weights, eligible dates and deadline timezone with the organizers.
2. Complete the smaller open-weight task when quota permits. The latest HTTP 429 attempt was incomplete; no automatic retry is scheduled.
3. Review the whole recording and upload an unedited take to YouTube/Vimeo. Keep failures visible.
4. Get procurement-officer feedback and record what was actually reviewed.
5. Have a human check legal interpretation, full tender criteria and financing rules.
6. Submit manually before the confirmed deadline and follow the commit cutoff.

Recorded local checks: 30 tests and 106 assertions passed, along with type checking, lint/format and backend/frontend builds. A fresh dependency audit found no advisories across 225 packages. Edge browser checks passed for stored execution and both packages; the fresh recording exercised the actual browser/agent path. These are observed results, not a guarantee that later revisions pass.

There are no GitHub Actions workflows or automatic paid tests. The app has not been deployed, and neither the video nor application has been submitted.

Public-file checks use Gitleaks 8.30.1, a private-reference/key-pattern scan and diff review. Local credentials, runs, dependencies and builds are excluded from publication.

## Open Questions / Things to Verify

Competition eligibility, the open-weight task, public video and officer feedback are the main submission gaps. Installed local-model reviews, hard cost caps and authenticated reviewer identity remain untested or unimplemented. The small fixed-runtime evaluation is not a representative reliability study. See [EVALS](../EVALS.md) and the [security audit](security-audit.md).
