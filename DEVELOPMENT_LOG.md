# Codex development log

Author: JahMari Harrigan. Implementation and documentation assisted by Codex.

## Session 1
The user supplied a previous Skyline demonstration as historical context, followed by the course rubric. The user requested a new Node.js, HTML, CSS, and MySQL application, accurate course reports, a PDF presentation guide, and a private GitHub repository. Resume work was explicitly deferred.

Design decision: one dated flight per booking, up to four passengers. Build genuine successive alpha, beta, and production classroom versions. Add a reproducible SQL analytics layer for a data analyst portfolio. No real payments or passenger information. Real three-user evaluation remains a student activity; automated results are recorded separately.

Environment discovery: Node and Git are available. MySQL is not installed on PATH. A portable MySQL download is being prepared in the workspace. The first download URL returned 404; switched to the official archives endpoint.

Alpha: 9 automated tests passed against MySQL 8.4.7. Initial dependency install via pnpm failed with a sandbox realpath error; npm succeeded. MySQL processes and tests had to share the same execution environment for loopback connectivity. Beta: added administrative catalog maintenance, dated schedules and cancellation, and route analytics with CSV export. All 13 beta tests passed. Browser connection from the in-app browser timed out; visual verification is still pending.
