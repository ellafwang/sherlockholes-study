# Case-file notebooks with saved colors

## What will change
- Replace the open-book notebook artwork with a detective case-file/folder illustration across the notebook list and empty state.
- Add a small accessible color picker to the New notebook window, with a curated set of distinct case-file colors.
- Save the selected color with each notebook so its case file keeps the same appearance after refresh.
- Show the chosen color on notebook cards and carry it into the notebook page header.

## Technical details
- Add a constrained `color` field to notebook storage with a safe default for existing notebooks.
- Update notebook types and creation logic to accept the selected color.
- Use semantic color tokens and a reusable case-file icon rather than hardcoded page colors.
- Verify notebook creation, persistence, navigation, and mobile/desktop presentation.
