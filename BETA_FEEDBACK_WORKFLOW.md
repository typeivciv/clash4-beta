# Beta Feedback Workflow

## Tester path

`Help → Send Feedback → Open GitHub Issue`

The game pre-fills the issue title and body with the beta version, issue category, viewport, screen size, pixel ratio, browser user-agent, observed behavior, reproduction steps, and expected behavior.

Testers without GitHub accounts can use Share Report or Copy Report.

## Suggested triage labels

Create these labels in GitHub when useful:

- `beta`
- `needs-triage`
- `mobile`
- `ui`
- `animation`
- `gameplay`
- `multiplayer`
- `accessibility`
- `performance`

Recommended workflow: new report → reproduce → label → fix on development branch → regression test → merge to `main` → GitHub Pages redeploys.

## Privacy

The repository and its Issues are public. The in-game report collects browser/device environment data but does not intentionally collect names, email addresses, phone numbers, account IDs, or precise location.
