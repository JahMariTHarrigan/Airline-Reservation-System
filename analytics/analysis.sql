-- Analysis grain: one booking, unless stated otherwise. All values are synthetic.
-- 1. Booking outcomes and net booked value. Not recognized accounting revenue.
SELECT status,COUNT(*) bookings,SUM(total_cents)/100.0 booked_value_usd
FROM bookings GROUP BY status;

-- 2. Booking-month cancellation rate. Cancellations are attributed to creation month.
SELECT DATE_FORMAT(created_at,'%Y-%m') booking_month,COUNT(*) bookings,
 SUM(status='cancelled') cancellations,
 ROUND(100.0*SUM(status='cancelled')/NULLIF(COUNT(*),0),2) cancellation_rate_pct,
 SUM(CASE WHEN status='confirmed' THEN total_cents ELSE 0 END)/100.0 net_booked_value_usd
FROM bookings GROUP BY booking_month ORDER BY booking_month;

-- 3. Capacity aggregation is performed before joining to bookings to avoid fan-out.
WITH aircraft_capacity AS (SELECT aircraft_id,COUNT(*) seats FROM seats GROUP BY aircraft_id),
allocations AS (SELECT instance_id,COUNT(*) occupied FROM seat_assignments WHERE released_at IS NULL GROUP BY instance_id)
SELECT f.origin,f.destination,COUNT(*) departures,SUM(c.seats) capacity,
 SUM(COALESCE(a.occupied,0)) occupied,
 ROUND(100.0*SUM(COALESCE(a.occupied,0))/NULLIF(SUM(c.seats),0),2) occupancy_pct
FROM flight_instances i JOIN flights f ON f.id=i.flight_id
JOIN aircraft_capacity c ON c.aircraft_id=i.aircraft_id
LEFT JOIN allocations a ON a.instance_id=i.id
WHERE i.status='scheduled' GROUP BY f.origin,f.destination;

-- 4. Rank routes by confirmed booking value, with ties sharing a rank.
WITH route_value AS (
 SELECT f.origin,f.destination,SUM(b.total_cents)/100.0 net_booked_value_usd
 FROM bookings b JOIN flight_instances i ON i.id=b.instance_id JOIN flights f ON f.id=i.flight_id
 WHERE b.status='confirmed' GROUP BY f.origin,f.destination
)
SELECT *,DENSE_RANK() OVER(ORDER BY net_booked_value_usd DESC) value_rank FROM route_value;

-- 5. Integrity exception report. Expected: zero rows.
SELECT b.reference,'fare mismatch' issue FROM bookings b
JOIN (SELECT booking_id,COUNT(*) n FROM booking_passengers GROUP BY booking_id) p ON p.booking_id=b.id
WHERE b.total_cents<>b.unit_fare_cents*p.n
UNION ALL
SELECT b.reference,'cancelled booking holds seat' FROM bookings b
JOIN seat_assignments s ON s.booking_id=b.id WHERE b.status='cancelled' AND s.released_at IS NULL;
