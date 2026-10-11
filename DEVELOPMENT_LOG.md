# Codex development log

Author: JahMari Harrigan. Implementation and documentation assisted by Codex.

## Session 1
The user supplied a previous Skyline demonstration as historical context, followed by the course rubric. The user requested a new Node.js, HTML, CSS, and MySQL application, accurate course reports, a PDF presentation guide, and a private GitHub repository. Resume work was explicitly deferred.

Design decision: one dated flight per booking, up to four passengers. Build genuine successive alpha, beta, and production classroom versions. Add a reproducible SQL analytics layer for a data analyst portfolio. No real payments or passenger information. Real three-user evaluation remains a student activity; automated results are recorded separately.

Environment discovery: Node and Git are available. MySQL is not installed on PATH. A portable MySQL download is being prepared in the workspace. The first download URL returned 404; switched to the official archives endpoint.

Alpha: 9 automated tests passed against MySQL 8.4.7. Initial dependency install via pnpm failed with a sandbox realpath error; npm succeeded. MySQL processes and tests had to share the same execution environment for loopback connectivity. Beta: added administrative catalog maintenance, dated schedules and cancellation, and route analytics with CSV export. All 13 beta tests passed. Browser connection from the in-app browser timed out; visual verification is still pending.

Production verification (October 10, 2026): all 16 HTTP/MySQL integration tests passed; T17 independently verified persisted bookings and sessions after application restart. A fresh database setup and the integration suite also passed. Dependency audit reported zero known production vulnerabilities at the recorded check. Five Word reports were rendered and every page visually inspected: definition 1 page, analysis 5, synthesis 4, implementation 3, evaluation 4. PDF companions use those verified renders. The video guide, blank real-user evaluation forms and synthetic-data case study were prepared separately. Browser interaction, three real user sessions, a genuine CLI-specific session if required, video recording, and private GitHub publishing remain pending. No results for those activities are fabricated.

Private GitHub publication completed October 10, 2026: https://github.com/JahMariTHarrigan/skyline-air-analytics. Source, 17 document/diagram assets, and original Git history bundle were verified remotely. GitHub Actions run 38027312838 passed setup, all integration tests and the restart persistence check after correcting database readiness. Upload review required blank example passwords and runtime-generated test credentials.

## Session 2 — New Codex CLI refinement session (October 10, 2026)

Refined My Bookings printing by adding `#lookup` to the existing print-only hiding rule in `public/styles.css`. Search controls are excluded from printing; booking details and normal screen styles remain unchanged. Five read-only static checks passed. Browser print verification remains pending. No database changes, booking resets, or publishing occurred. Prompt, explanation, changed files, and actual verification results are recorded in `evidence/cli-print-review.md`.

Follow-up to Session 2: owner supplied the refreshed My Bookings print preview on October 10, 2026. Desktop review confirmed that search controls were hidden and all requested booking details and the $350 total remained readable on one page. Screenshot saved as evidence/cli-print-after.png; verification appended to evidence/cli-print-review.md. This follow-up closes the pending print-preview check without attributing browser operation to the CLI.

Desktop documentation follow-up: incorporated the guided owner walkthrough and actual screenshots into Test_and_Evaluation, corrected composite UNIQUE superkey terminology in Problem_Analysis, and updated Solution_Synthesis, Implementation_Report, README and the submission checklist. Participant evaluations remain pending. The reports distinguish observed screenshots from owner-reported checks and retain original automated evidence.

Participant planning follow-up (October 10, 2026): recorded the owner's supplied November 5, 11 and 13 dates as scheduled sessions, with attributed feedback and unverified completion dates. Ratings supplied were 3/5, 5/5 and 5/5. Documented unclear labels and an initial unsaved booking separately from the later reported success; no cause or fix is claimed. The three-user evaluation requirement remains open.


Participant clarification: owner confirms all sessions occurred, both issues were resolved and Participant 2 confirmed both fixes. Actual dates are pending retrieval; prior November dates are withdrawn as completion dates. Evaluation now records attributed results and overall-only ratings. Specific technical corrections remain undocumented. This supersedes the earlier scheduled-session interpretation.


Participant feedback correction: latest owner clarification replaces P01’s attributed booking-saving defect with navigation wording feedback. Vague one-word tabs were reportedly clarified, P02 confirmed the improvement, and the owner attributes P02/P03 overall 5/5 ratings to it. Actual dates and exact wording changes remain pending. Earlier entries are historical and superseded by this correction.


Wording follow-up: changed Find a flight to Flight in all 14 HTML navigation bars at owner request. Verified the exact demo notice and descriptive homepage copy already existed. Updated evaluation with exact supplied wording and source chronology; participant dates remain pending.


Correction: owner intended documentation of prior wording improvements, not a new navigation change. Restored Find a flight across all 14 pages and corrected evaluation wording. The prior Flight edit was an assistant misunderstanding, not a participant-requested fix.


Latest owner date correction: P01 October 2, 2026; P02 October 5, 2026; P03 October 11, 2026. The wording improvement was reportedly made the same day as P01; P02 retested it and completed the other tasks. Four category ratings and the P03 administrator fare-change task are recorded in Test_and_Evaluation. These details supersede the earlier missing-date, reversed-date and overall-only notes. Tested versions and alignment with the recorded development timeline remain unverified.
