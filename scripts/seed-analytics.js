// same sample booking data each run, not real airline data
import { query, transaction, pool } from "../src/db.js";
const [owner] = await query(
  "SELECT id FROM users WHERE email='customer@example.test'",
);
if (!owner) throw Error("Run setup first.");
if (
  (await query("SELECT id FROM bookings WHERE reference LIKE 'SYNTH%'")).length
)
  throw Error(
    "Synthetic dataset already exists. Use a fresh database to regenerate.",
  );
const instances = await query(
  "SELECT * FROM flight_instances WHERE status='scheduled' ORDER BY departure,id LIMIT 60",
);
let n = 0;
for (let index = 0; index < instances.length; index++) {
  const f = instances[index],
    seats = await query("SELECT * FROM seats WHERE aircraft_id=? ORDER BY id", [
      f.aircraft_id,
    ]);
  const count = 4 + ((index * 7) % 15);
  for (let j = 0; j < count; j++) {
    const cancelled = (index + j) % 5 === 0,
      reference = "SYNTH" + String(++n).padStart(11, "0");
    const created = new Date(Date.UTC(2026, 5 + (index % 4), 1 + (j % 25), 12));
    const stamp = (d) => d.toISOString().slice(0, 19).replace("T", " "),
      createdAt = stamp(created),
      cancelledAt = cancelled ? stamp(new Date(+created + 86400000)) : null;
    await transaction(async (c) => {
      const [b] = await c.execute(
        "INSERT INTO bookings(reference,user_id,instance_id,unit_fare_cents,total_cents,status,created_at,cancelled_at) VALUES (?,?,?,?,?,?,?,?)",
        [
          reference,
          owner.id,
          f.id,
          f.fare_cents,
          f.fare_cents,
          cancelled ? "cancelled" : "confirmed",
          createdAt,
          cancelledAt,
        ],
      );
      const [p] = await c.execute("INSERT INTO passengers(name) VALUES (?)", [
        "Synthetic Passenger " + n,
      ]);
      await c.execute("INSERT INTO booking_passengers VALUES (?,?)", [
        b.insertId,
        p.insertId,
      ]);
      await c.execute(
        "INSERT INTO seat_assignments(booking_id,passenger_id,instance_id,aircraft_id,seat_id,released_at) VALUES (?,?,?,?,?,?)",
        [b.insertId, p.insertId, f.id, f.aircraft_id, seats[j].id, cancelledAt],
      );
      await c.execute(
        "INSERT INTO payments(booking_id,amount_cents,status) VALUES (?,?,?)",
        [b.insertId, f.fare_cents, cancelled ? "voided" : "simulated"],
      );
    });
  }
}
console.log(
  `Created ${n} deterministic synthetic reservations across ${instances.length} dated departures. This is a designed scenario, not measured customer behavior.`,
);
await pool.end();
