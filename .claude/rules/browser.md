## Browser Windows

Close the built-in browser (the `mcp__Claude_Browser__*` pane) whenever it is not in use. An open page keeps running — Play holds SSE streams, audio, and video — and every open session adds load for everyone sharing the environment.

- **Close when you finish with it.** As soon as a verification or inspection is done and nothing in the next step needs the page, close every tab you opened with `tabs_close`; closing the last tab closes the pane. Do this before wrapping up the turn, not at the end of the session.
- **Do not leave it open "for the user to look at".** Share what you saw (a screenshot, the measured values) in the reply instead. Reopen it only when the user asks to see it live.
- **Stop dev servers you started with `preview_start`** (`preview_stop`) when you are done with them. A server that was already running before you started is not yours to stop; if `preview_start` reports the port is in use, drive the existing server and leave it running.
- **Open one tab at a time** and reuse it by navigating, rather than opening a new tab per page.
- **Applies to Claude in Chrome too:** close any tab you created with `tabs_close_mcp` when the task is done.
