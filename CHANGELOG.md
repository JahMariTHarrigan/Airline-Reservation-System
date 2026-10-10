# Change log

## Alpha
Customer registration/login/logout, persistent database sessions, flight search/details, group passenger entry, seat selection, confirmation, owned lookup, cancellation and printable HTML. MySQL transaction and active seat uniqueness. Nine passing automated tests.

## Beta
1. Added administrator catalog and dated schedules, including aircraft overlap checks.
2. Added explicit fare history verification and bulk departure cancellation.
3. Added protected route metrics, data-quality checks and CSV export.
Thirteen passing automated tests. No schema migration was needed.

## Production classroom release
1. Added deterministic synthetic reservations, SQL CTE/window-function analysis and metric definitions.
2. Added authentication throttling and cross-origin write validation; configured database session timezone explicitly to UTC.
3. Added full-capacity, schedule conflict, logout and referential-integrity tests, plus a separate server restart check.
4. Verified setup in a newly created MySQL database.
5. Added reports, ER diagram, interface wireframes, user evaluation forms and a PDF video guide.

Sixteen integration tests and the restart check passed before packaging. Browser/manual participant evidence is still outstanding. Earlier failed environment runs are described in DEVELOPMENT_LOG.md; they are not represented as passing tests.
