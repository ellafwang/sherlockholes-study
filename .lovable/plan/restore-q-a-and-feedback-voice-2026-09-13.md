# Restore Q&A and Feedback Voice

## Changes
- Reset Sherlock to the neutral expression immediately when Session Feedback is opened after Q&A.
- Make each newly displayed Q&A question trigger Sherlock’s voice exactly once.
- Make the completed feedback summary begin narration when its text becomes visible.
- Preserve existing behavior that stops speech when changing panels or leaving the session.
- Surface voice connection or playback errors clearly instead of failing silently.

## Verification
- Check the Q&A question transition, feedback expression reset, summary narration trigger, and voice stop behavior in the running app.
- Confirm the session page still loads without hook-order or browser errors.

## Technical details
- Update the session view’s panel-transition and speech effects while retaining the server-only ElevenLabs key and existing selected voice.
- Adjust speech request/playback state so panel-change cancellation does not cancel the newly requested Q&A or feedback narration.
