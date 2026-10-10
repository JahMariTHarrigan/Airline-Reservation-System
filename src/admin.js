import { Router } from "express";
import { query, transaction } from "./db.js";
export const adminRoutes = Router();
const fail = (m, s = 400) => Object.assign(new Error(m), { status: s });
const str = (x, n = 80) =>
  typeof x === "string" && x.trim().length > 0 && x.length <= n;
const integer = (x) => Number.isSafeInteger(Number(x)) && Number(x) > 0;
const date = (x) =>
  typeof x === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(x) &&
  Number.isFinite(Date.parse(x + "Z"));
adminRoutes.use((req, res, next) => {
  if (req.session?.role !== "admin")
    return next(fail("Administrator access required.", 403));
  if (
    req.method !== "GET" &&
    req.headers["x-csrf-token"] !== req.session.csrf_token
  )
    return next(fail("Session verification failed.", 403));
  next();
});
adminRoutes.get("/catalog", async (req, res) =>
  res.json({
    airports: await query("SELECT * FROM airports ORDER BY code"),
    aircraft: await query(
      "SELECT a.*,COUNT(s.id) capacity FROM aircraft a LEFT JOIN seats s ON s.aircraft_id=a.id GROUP BY a.id",
    ),
    flights: await query("SELECT * FROM flights ORDER BY number"),
    instances: await query(
      "SELECT i.*,f.number,f.origin,f.destination FROM flight_instances i JOIN flights f ON f.id=i.flight_id ORDER BY departure DESC LIMIT 300",
    ),
  }),
);
adminRoutes.post("/airports", async (req, res) => {
  const b = req.body;
  if (
    !/^[A-Z]{3}$/.test(b.code) ||
    !str(b.name, 100) ||
    !str(b.city) ||
    !str(b.timezone, 60)
  )
    throw fail("Enter a three-letter airport code, name, city and timezone.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: b.timezone });
  } catch {
    throw fail("Enter a valid IANA timezone.");
  }
  await query(
    "INSERT INTO airports(code,name,city,timezone) VALUES (?,?,?,?)",
    [b.code, b.name.trim(), b.city.trim(), b.timezone],
  );
  res.status(201).json({ message: "Airport added." });
});
adminRoutes.put("/airports/:code", async (req, res) => {
  const b = req.body;
  if (!str(b.name, 100) || !str(b.city) || !str(b.timezone, 60))
    throw fail("Enter all airport details.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: b.timezone });
  } catch {
    throw fail("Invalid timezone.");
  }
  const r = await query(
    "UPDATE airports SET name=?,city=?,timezone=? WHERE code=?",
    [b.name.trim(), b.city.trim(), b.timezone, req.params.code],
  );
  if (!r.affectedRows) throw fail("Airport not found.", 404);
  res.json({ message: "Airport updated." });
});
adminRoutes.post("/aircraft", async (req, res) => {
  const b = req.body;
  if (
    !str(b.registration, 12) ||
    !str(b.model) ||
    !integer(b.rows) ||
    b.rows > 30
  )
    throw fail("Enter registration, model and 1 to 30 rows.");
  await transaction(async (c) => {
    const [r] = await c.execute(
      "INSERT INTO aircraft(registration,model) VALUES (?,?)",
      [b.registration.trim().toUpperCase(), b.model.trim()],
    );
    for (let row = 1; row <= b.rows; row++)
      for (const letter of "ABCD")
        await c.execute("INSERT INTO seats(aircraft_id,label) VALUES (?,?)", [
          r.insertId,
          row + letter,
        ]);
  });
  res.status(201).json({ message: "Aircraft and seats added." });
});
adminRoutes.put("/aircraft/:id", async (req, res) => {
  const b = req.body;
  if (!str(b.registration, 12) || !str(b.model))
    throw fail("Enter registration and model.");
  const r = await query(
    "UPDATE aircraft SET registration=?,model=? WHERE id=?",
    [b.registration.trim().toUpperCase(), b.model.trim(), req.params.id],
  );
  if (!r.affectedRows) throw fail("Aircraft not found.", 404);
  res.json({ message: "Aircraft updated. Seat layout remains fixed." });
});
adminRoutes.post("/flights", async (req, res) => {
  const b = req.body;
  if (
    !/^[A-Z0-9]{2,10}$/.test(b.number) ||
    !/^[A-Z]{3}$/.test(b.origin) ||
    !/^[A-Z]{3}$/.test(b.destination) ||
    b.origin === b.destination
  )
    throw fail("Enter a flight number and different airports.");
  await query("INSERT INTO flights(number,origin,destination) VALUES (?,?,?)", [
    b.number,
    b.origin,
    b.destination,
  ]);
  res.status(201).json({ message: "Flight definition added." });
});
adminRoutes.put("/flights/:id", async (req, res) => {
  const b = req.body;
  if (
    !/^[A-Z0-9]{2,10}$/.test(b.number) ||
    !/^[A-Z]{3}$/.test(b.origin) ||
    !/^[A-Z]{3}$/.test(b.destination) ||
    b.origin === b.destination
  )
    throw fail("Enter a flight number and different airports.");
  await transaction(async (c) => {
    await c.execute("SELECT id FROM flights WHERE id=? FOR UPDATE", [
      req.params.id,
    ]);
    const [[count]] = await c.execute(
      "SELECT COUNT(*) n FROM flight_instances WHERE flight_id=?",
      [req.params.id],
    );
    if (count.n)
      throw fail(
        "A flight with dated departures cannot change route. Create another flight definition.",
      );
    const [r] = await c.execute(
      "UPDATE flights SET number=?,origin=?,destination=? WHERE id=?",
      [b.number, b.origin, b.destination, req.params.id],
    );
    if (!r.affectedRows) throw fail("Flight not found.", 404);
  });
  res.json({ message: "Flight updated." });
});
adminRoutes.post("/instances", async (req, res) => {
  const b = req.body;
  if (
    !integer(b.flight_id) ||
    !integer(b.aircraft_id) ||
    !date(b.departure) ||
    !date(b.arrival) ||
    b.arrival <= b.departure ||
    Date.parse(b.departure + "Z") <= Date.now() ||
    !integer(b.fare_cents) ||
    b.fare_cents > 10000000
  )
    throw fail(
      "Enter a future departure, later arrival, aircraft and positive fare in cents.",
    );
  await transaction(async (c) => {
    await c.execute("SELECT id FROM aircraft WHERE id=? FOR UPDATE", [
      b.aircraft_id,
    ]);
    const [[overlap]] = await c.execute(
      "SELECT COUNT(*) n FROM flight_instances WHERE aircraft_id=? AND status=? AND departure<? AND arrival>?",
      [
        b.aircraft_id,
        "scheduled",
        b.arrival.replace("T", " "),
        b.departure.replace("T", " "),
      ],
    );
    if (overlap.n)
      throw fail("This aircraft already has an overlapping departure.");
    await c.execute(
      "INSERT INTO flight_instances(flight_id,aircraft_id,departure,arrival,fare_cents) VALUES (?,?,?,?,?)",
      [
        b.flight_id,
        b.aircraft_id,
        b.departure.replace("T", " "),
        b.arrival.replace("T", " "),
        b.fare_cents,
      ],
    );
  });
  res.status(201).json({ message: "Departure scheduled." });
});
adminRoutes.put("/instances/:id", async (req, res) => {
  const b = req.body;
  if (
    !integer(b.fare_cents) ||
    b.fare_cents > 10000000 ||
    !["scheduled", "cancelled"].includes(b.status)
  )
    throw fail("Enter a positive fare and valid status.");
  await transaction(async (c) => {
    const [[i]] = await c.execute(
      "SELECT * FROM flight_instances WHERE id=? FOR UPDATE",
      [req.params.id],
    );
    if (!i) throw fail("Departure not found.", 404);
    if (i.status === "cancelled" && b.status === "scheduled")
      throw fail(
        "Cancelled departures cannot be reopened. Create a new departure.",
      );
    await c.execute(
      "UPDATE flight_instances SET fare_cents=?,status=? WHERE id=?",
      [b.fare_cents, b.status, i.id],
    );
    if (b.status === "cancelled") {
      await c.execute(
        "UPDATE bookings SET status=?,cancelled_at=COALESCE(cancelled_at,UTC_TIMESTAMP()) WHERE instance_id=?",
        ["cancelled", i.id],
      );
      await c.execute(
        "UPDATE seat_assignments SET released_at=COALESCE(released_at,UTC_TIMESTAMP()) WHERE instance_id=?",
        [i.id],
      );
      await c.execute(
        "UPDATE payments p JOIN bookings b ON b.id=p.booking_id SET p.status=? WHERE b.instance_id=?",
        ["voided", i.id],
      );
    }
  });
  res.json({
    message: "Departure updated. Existing booking fares are preserved.",
  });
});
adminRoutes.get("/reservations", async (req, res) =>
  res.json(
    await query(
      "SELECT b.*,u.email,f.number FROM bookings b JOIN users u ON u.id=b.user_id JOIN flight_instances i ON i.id=b.instance_id JOIN flights f ON f.id=i.flight_id ORDER BY b.created_at DESC LIMIT 300",
    ),
  ),
);
const routeSQL = `SELECT f.origin,f.destination,COUNT(DISTINCT i.id) departures,
 SUM((SELECT COUNT(*) FROM seats s WHERE s.aircraft_id=i.aircraft_id)) capacity,
 SUM((SELECT COUNT(*) FROM seat_assignments sa WHERE sa.instance_id=i.id AND sa.released_at IS NULL)) occupied,
 SUM((SELECT COALESCE(SUM(b.total_cents),0) FROM bookings b WHERE b.instance_id=i.id AND b.status='confirmed')) revenue_cents
 FROM flight_instances i JOIN flights f ON f.id=i.flight_id WHERE i.status='scheduled' GROUP BY f.origin,f.destination ORDER BY revenue_cents DESC`;
adminRoutes.get("/analytics", async (req, res) => {
  const [kpi] = await query(
    "SELECT COUNT(*) bookings,COALESCE(SUM(status='cancelled'),0) cancellations,COALESCE(SUM(CASE WHEN status='confirmed' THEN total_cents ELSE 0 END),0) revenue_cents FROM bookings",
  );
  const routes = await query(routeSQL);
  const monthly = await query(
    "SELECT DATE_FORMAT(created_at,'%Y-%m') month,COUNT(*) bookings,SUM(status='cancelled') cancellations,SUM(CASE WHEN status='confirmed' THEN total_cents ELSE 0 END) revenue_cents FROM bookings GROUP BY month ORDER BY month",
  );
  const [quality] = await query(
    "SELECT (SELECT COUNT(*) FROM bookings b WHERE total_cents<>unit_fare_cents*(SELECT COUNT(*) FROM booking_passengers bp WHERE bp.booking_id=b.id)) fare_mismatches,(SELECT COUNT(*) FROM bookings b JOIN payments p ON p.booking_id=b.id WHERE b.total_cents<>p.amount_cents OR (b.status='cancelled' AND p.status<>'voided')) payment_mismatches,(SELECT COUNT(*) FROM seat_assignments sa JOIN bookings b ON b.id=sa.booking_id WHERE b.status='cancelled' AND sa.released_at IS NULL) cancelled_active_seats",
  );
  res.json({
    kpi,
    routes,
    monthly,
    quality,
    scope:
      "All seeded and interactive bookings. Scheduled-departure occupancy. Synthetic classroom data only.",
  });
});
adminRoutes.get("/analytics.csv", async (req, res) => {
  const rows = await query(routeSQL);
  res
    .type("text/csv")
    .set("Content-Disposition", 'attachment; filename="route-analytics.csv"')
    .send(
      "origin,destination,departures,capacity,occupied,revenue_cents\r\n" +
        rows
          .map((r) =>
            [
              r.origin,
              r.destination,
              r.departures,
              r.capacity,
              r.occupied,
              r.revenue_cents,
            ].join(","),
          )
          .join("\r\n"),
    );
});
