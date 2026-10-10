# Metric definitions and interpretation

This dataset is synthetic. No result estimates real airline demand or customer behavior.

| Metric | Definition | Grain and caveat |
|---|---|---|
| Reservations | Count of booking records | One booking can contain up to four passengers |
| Net booked value | Sum of confirmed booking totals in cents / 100 | Not recognized revenue, cash receipts or profit |
| Cancellation rate | Cancelled bookings / all bookings | Attributed to booking creation month, not cancellation month |
| Scheduled occupancy | Active seat assignments / seats across scheduled departures | Capacity is counted once per dated departure; cancelled departures excluded |
| Route booked value | Confirmed booking totals grouped by origin and destination | Direction matters; cancelled departures' reservations are cancelled together |

## Data provenance
`seed.sql` supplies fictional operational records. `scripts/setup.js` creates 30 days of dated departures relative to installation day. `scripts/seed-analytics.js` creates a deterministic scenario over the first 60 departures, with 4 to 18 reservations per departure and a deliberately designed cancellation pattern. Booking creation months are June through September 2026. Run this optional scenario on a fresh classroom database. The script refuses a second run. It is not a statistical sample, forecast, or claim about market conditions.

## Analyst workflow
1. Identify the grain of each table before joining. A booking-to-passenger join can multiply monetary totals.
2. Check fare, payment and allocation consistency before reporting.
3. Aggregate capacity per aircraft and allocations per instance before route joins.
4. Compare the SQL output to the administrator dashboard and downloaded CSV.
5. State the denominator and exclusions alongside each percentage.
6. Record findings as observations about the generated scenario, with no causal claims.

## Limitations
No real demand, costs, seasonality, refunds, exchange rates, marketing attribution or no-show records. Occupancy is a reservation snapshot, not flown load factor. Revenue recognition, profit and forecasting are out of scope. Interactive test bookings change the dashboard, so reproduce portfolio numbers on a clean seeded database.
