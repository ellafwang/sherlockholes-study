# Feedback Sidebar and Detective Background

## What will change
- Add a collapsible left sidebar across the app, with an always-visible reopen control.
- List every session that has feedback, using the session name and a short, scannable summary.
- Make each entry open that session directly in its feedback view.
- Add a subtle transparent repeating background of magnifying glasses, case files, spectacles, and mustaches without reducing text readability.
- Keep the sidebar usable as a slide-out panel on smaller screens.

## Technical details
- Query saved session summaries together with their session records from the existing database.
- Add a shared app-shell/sidebar component around all routes and use the existing sidebar controls.
- Read a feedback-view URL flag on session pages so sidebar links land on the saved report.
- Add semantic sidebar color tokens and a lightweight CSS pattern using embedded decorative icons.
- Verify desktop and mobile layouts, sidebar collapse/reopen behavior, and direct feedback navigation.
