import { test, after } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/server.js";
import { pool, query } from "../src/db.js";
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = "http://127.0.0.1:" + server.address().port;
const accounts = [];
const testInstances = [];
async function request(path, method = "GET", body, client = {}) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: client.cookie || "",
      "X-CSRF-Token": client.csrf || "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
async function account() {
  const email = "test-" + crypto.randomUUID() + "@example.test",
    password = crypto.randomUUID();
  const r = await request("/register", "POST", {
    name: "Synthetic Tester",
    email,
    password,
  });
  assert.equal(r.status, 201);
  const login = await request("/login", "POST", { email, password });
  const s = await request("/session", "GET", null, { cookie: login.cookie });
  const client = {
    cookie: login.cookie,
    csrf: s.data.csrf,
    id: s.data.user.id,
  };
  accounts.push(client.id);
  return client;
}
let first, second, flight, booking;
test("T01 registration validation and valid login", async () => {
  assert.equal(
    (
      await request("/register", "POST", {
        name: "",
        email: "bad",
        password: crypto.randomUUID().slice(0, 5),
      })
    ).status,
    400,
  );
  first = await account();
  second = await account();
  assert.equal(
    (
      await request("/login", "POST", {
        email: "missing@example.test",
        password: crypto.randomUUID(),
      })
    ).status,
    401,
  );
});
test("T02 flight search and empty/invalid searches", async () => {
  const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const r = await request("/flights?origin=ATL&destination=JFK&date=" + date);
  assert.equal(r.status, 200);
  assert.ok(r.data.length);
  flight = (await request("/flights/" + r.data[0].id)).data;
  assert.equal(
    (await request("/flights?origin=ATL&destination=ATL&date=" + date)).status,
    400,
  );
  assert.equal(
    (await request("/flights?origin=ATL&destination=JFK&date=2026-02-31"))
      .status,
    400,
  );
  assert.deepEqual(
    (await request("/flights?origin=LAX&destination=ORD&date=" + date)).data,
    [],
  );
});
test("T03 unauthorized and CSRF requests rejected", async () => {
  assert.equal((await request("/bookings")).status, 401);
  assert.equal(
    (await request("/bookings", "POST", {}, { cookie: first.cookie })).status,
    403,
  );
});
test("T04 booking ignores client price and persists all related records", async () => {
  const r = await request(
    "/bookings",
    "POST",
    {
      instance_id: flight.id,
      total_cents: 1,
      passengers: [{ name: "Demo One", seat_id: flight.seats[0].id }],
    },
    first,
  );
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.total_cents, flight.fare_cents);
  booking = (
    await request("/bookings?reference=" + r.data.reference, "GET", null, first)
  ).data[0];
  assert.equal(booking.passengers.length, 1);
  assert.equal(
    (await query("SELECT * FROM payments WHERE booking_id=?", [booking.id]))
      .length,
    1,
  );
});
test("T05 customers cannot read or cancel another customer booking", async () => {
  assert.deepEqual(
    (
      await request(
        "/bookings?reference=" + booking.reference,
        "GET",
        null,
        second,
      )
    ).data,
    [],
  );
  assert.equal(
    (await request("/bookings/" + booking.id + "/cancel", "POST", {}, second))
      .status,
    404,
  );
});
test("T06 concurrent attempts reserve a seat only once", async () => {
  const body = {
    instance_id: flight.id,
    passengers: [{ name: "Race Test", seat_id: flight.seats[1].id }],
  };
  const r = await Promise.all([
    request("/bookings", "POST", body, first),
    request("/bookings", "POST", body, second),
  ]);
  assert.deepEqual(r.map((x) => x.status).sort(), [201, 409]);
  const rows = await query(
    "SELECT COUNT(*) n FROM seat_assignments WHERE instance_id=? AND seat_id=? AND released_at IS NULL",
    [flight.id, flight.seats[1].id],
  );
  assert.equal(rows[0].n, 1);
});
test("T07 failed multi-passenger booking rolls back every inserted record", async () => {
  const before = (await query("SELECT COUNT(*) n FROM bookings"))[0].n;
  const people = (await query("SELECT COUNT(*) n FROM passengers"))[0].n;
  const r = await request(
    "/bookings",
    "POST",
    {
      instance_id: flight.id,
      passengers: [
        { name: "Would Roll Back", seat_id: flight.seats[2].id },
        { name: "Conflict", seat_id: flight.seats[0].id },
      ],
    },
    second,
  );
  assert.equal(r.status, 409);
  assert.equal((await query("SELECT COUNT(*) n FROM bookings"))[0].n, before);
  assert.equal((await query("SELECT COUNT(*) n FROM passengers"))[0].n, people);
});
test("T08 cancellation releases inventory and voids simulated payment", async () => {
  assert.equal(
    (await request("/bookings/" + booking.id + "/cancel", "POST", {}, first))
      .status,
    200,
  );
  const b = (
    await request(
      "/bookings?reference=" + booking.reference,
      "GET",
      null,
      first,
    )
  ).data[0];
  assert.equal(b.status, "cancelled");
  assert.equal(
    (await query("SELECT status FROM payments WHERE booking_id=?", [b.id]))[0]
      .status,
    "voided",
  );
  assert.equal(
    (await request("/flights/" + flight.id)).data.seats[0].occupied,
    0,
  );
});
test("T09 invalid passengers and seats are rejected", async () => {
  assert.equal(
    (
      await request(
        "/bookings",
        "POST",
        { instance_id: flight.id, passengers: [null] },
        first,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/bookings",
        "POST",
        {
          instance_id: flight.id,
          passengers: [{ name: "Bad Seat", seat_id: 999999 }],
        },
        first,
      )
    ).status,
    400,
  );
});
let administrator;
test("T10 admin authorization and catalog", async () => {
  assert.equal(
    (await request("/admin/catalog", "GET", null, first)).status,
    403,
  );
  const l = await request("/login", "POST", {
    email: "admin@example.test",
    password: process.env.DEMO_PASSWORD,
  });
  assert.equal(l.status, 200);
  const s = await request("/session", "GET", null, { cookie: l.cookie });
  administrator = { cookie: l.cookie, csrf: s.data.csrf };
  assert.equal(
    (await request("/admin/catalog", "GET", null, administrator)).status,
    200,
  );
});
test("T11 fare edits preserve existing booking totals", async () => {
  const saved = await query(
    "SELECT total_cents FROM bookings WHERE instance_id=?",
    [flight.id],
  );
  const r = await request(
    "/admin/instances/" + flight.id,
    "PUT",
    { fare_cents: flight.fare_cents + 100, status: "scheduled" },
    administrator,
  );
  assert.equal(r.status, 200);
  assert.deepEqual(
    await query("SELECT total_cents FROM bookings WHERE instance_id=?", [
      flight.id,
    ]),
    saved,
  );
  await request(
    "/admin/instances/" + flight.id,
    "PUT",
    { fare_cents: flight.fare_cents, status: "scheduled" },
    administrator,
  );
});
test("T12 analytics reconcile and quality counts are zero", async () => {
  const r = await request("/admin/analytics", "GET", null, administrator);
  assert.equal(r.status, 200);
  assert.ok(r.data.routes.length);
  assert.deepEqual(Object.values(r.data.quality), [0, 0, 0]);
  const [sum] = await query(
    "SELECT COALESCE(SUM(total_cents),0) n FROM bookings WHERE status='confirmed'",
  );
  assert.equal(Number(r.data.kpi.revenue_cents), Number(sum.n));
});
test("T13 admin can create and edit airport and aircraft records", async () => {
  assert.equal(
    (
      await request(
        "/admin/airports",
        "POST",
        {
          code: "ZZZ",
          name: "Synthetic Test Airport",
          city: "Testville",
          timezone: "Etc/UTC",
        },
        administrator,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await request(
        "/admin/airports/ZZZ",
        "PUT",
        {
          name: "Updated Test Airport",
          city: "Testville",
          timezone: "Etc/UTC",
        },
        administrator,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/admin/aircraft",
        "POST",
        { registration: "TEST01", model: "Test plane", rows: 1 },
        administrator,
      )
    ).status,
    201,
  );
  const [a] = await query(
    "SELECT id FROM aircraft WHERE registration='TEST01'",
  );
  assert.equal(
    (await query("SELECT COUNT(*) n FROM seats WHERE aircraft_id=?", [a.id]))[0]
      .n,
    4,
  );
  await query("DELETE FROM seats WHERE aircraft_id=?", [a.id]);
  await query("DELETE FROM aircraft WHERE id=?", [a.id]);
  await query("DELETE FROM airports WHERE code='ZZZ'");
});
test("T14 full departure, schedule conflicts and departure cancellation", async () => {
  const dt = new Date(Date.now() + 80 * 86400000);
  dt.setUTCHours(8, 0, 0, 0);
  const departure = dt.toISOString().slice(0, 16),
    arrival = new Date(+dt + 5400000).toISOString().slice(0, 16),
    body = {
      flight_id: 1,
      aircraft_id: 1,
      departure,
      arrival,
      fare_cents: 15000,
    };
  assert.equal(
    (await request("/admin/instances", "POST", body, administrator)).status,
    201,
  );
  const [instance] = await query(
    "SELECT id FROM flight_instances WHERE departure=? AND flight_id=1",
    [departure.replace("T", " ")],
  );
  testInstances.push(instance.id);
  assert.equal(
    (
      await request(
        "/admin/instances",
        "POST",
        { ...body, flight_id: 2 },
        administrator,
      )
    ).status,
    400,
  );
  const seats = (await request("/flights/" + instance.id)).data.seats;
  for (let i = 0; i < seats.length; i += 4)
    assert.equal(
      (
        await request(
          "/bookings",
          "POST",
          {
            instance_id: instance.id,
            passengers: seats
              .slice(i, i + 4)
              .map((s) => ({
                name: "Capacity Tester " + s.label,
                seat_id: s.id,
              })),
          },
          first,
        )
      ).status,
      201,
    );
  assert.equal(
    (await request("/flights/" + instance.id)).data.occupied,
    seats.length,
  );
  assert.equal(
    (
      await request(
        "/bookings",
        "POST",
        {
          instance_id: instance.id,
          passengers: [{ name: "Over Capacity", seat_id: seats[0].id }],
        },
        second,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        "/admin/instances/" + instance.id,
        "PUT",
        { fare_cents: 15000, status: "cancelled" },
        administrator,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await query(
        "SELECT COUNT(*) n FROM seat_assignments WHERE instance_id=? AND released_at IS NULL",
        [instance.id],
      )
    )[0].n,
    0,
  );
  assert.equal(
    (
      await query(
        "SELECT COUNT(*) n FROM bookings WHERE instance_id=? AND status='confirmed'",
        [instance.id],
      )
    )[0].n,
    0,
  );
});
test("T15 logout invalidates persisted session", async () => {
  assert.equal((await request("/logout", "POST", {}, second)).status, 200);
  assert.equal((await request("/bookings", "GET", null, second)).status, 401);
});
test("T16 MySQL rejects invalid relationships and dates", async () => {
  await assert.rejects(
    query(
      "INSERT INTO flights(number,origin,destination) VALUES ('BADFK','XXX','JFK')",
    ),
  );
  await assert.rejects(
    query(
      "INSERT INTO flights(number,origin,destination) VALUES ('BADROUTE','ATL','ATL')",
    ),
  );
});
after(async () => {
  for (const user of accounts) {
    const ids = await query("SELECT id FROM bookings WHERE user_id=?", [user]);
    for (const { id } of ids) {
      const ps = await query(
        "SELECT passenger_id FROM booking_passengers WHERE booking_id=?",
        [id],
      );
      await query("DELETE FROM payments WHERE booking_id=?", [id]);
      await query("DELETE FROM seat_assignments WHERE booking_id=?", [id]);
      await query("DELETE FROM booking_passengers WHERE booking_id=?", [id]);
      await query("DELETE FROM bookings WHERE id=?", [id]);
      for (const p of ps)
        await query("DELETE FROM passengers WHERE id=?", [p.passenger_id]);
    }
    await query("DELETE FROM users WHERE id=?", [user]);
  }
  for (const id of testInstances)
    await query("DELETE FROM flight_instances WHERE id=?", [id]);
  await new Promise((r) => server.close(r));
  await pool.end();
});


