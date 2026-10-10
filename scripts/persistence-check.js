import { spawn } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import assert from "node:assert/strict";
import { query, pool } from "../src/db.js";
const port = 3099,
  base = "http://127.0.0.1:" + port;
let child, cookie, csrf, reference, userId;
async function start() {
  child = spawn(process.execPath, ["src/server.js"], {
    env: { ...process.env, PORT: String(port) },
    windowsHide: true,
    stdio: "ignore",
  });
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(base + "/api/health");
      if (r.ok) return;
    } catch {}
    await pause(100);
  }
  throw Error("Server did not become ready");
}
async function stop() {
  if (!child) return;
  const p = new Promise((r) => child.once("exit", r));
  child.kill();
  await p;
  child = null;
}
async function api(path, method = "GET", body) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie || "",
      "X-CSRF-Token": csrf || "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.headers.get("set-cookie"))
    cookie = r.headers.get("set-cookie").split(";")[0];
  const d = await r.json();
  assert.ok(r.ok, JSON.stringify(d));
  return d;
}
try {
  await start();
  const email = "restart-" + crypto.randomUUID() + "@example.test",
    password = crypto.randomUUID();
  await api("/register", "POST", { name: "Restart Tester", email, password });
  await api("/login", "POST", { email, password });
  const session = await api("/session");
  csrf = session.csrf;
  userId = session.user.id;
  const date = new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10);
  const [f] = await api("/flights?origin=ATL&destination=JFK&date=" + date);
  const detail = await api("/flights/" + f.id);
  const b = await api("/bookings", "POST", {
    instance_id: f.id,
    passengers: [
      {
        name: "Restart Tester",
        seat_id: detail.seats.find((s) => !s.occupied).id,
      },
    ],
  });
  reference = b.reference;
  await stop();
  await start();
  const [saved] = await api("/bookings?reference=" + reference);
  assert.equal(saved.reference, reference);
  assert.equal(saved.total_cents, f.fare_cents);
  assert.equal(saved.passengers[0].name, "Restart Tester");
  await api("/bookings/" + saved.id + "/cancel", "POST", {});
  console.log(
    "PASS T17: booking, passenger, price and database-backed session survived a Node.js server restart; cancellation succeeded after restart.",
  );
} finally {
  await stop();
  if (userId) {
    const bookings = await query("SELECT id FROM bookings WHERE user_id=?", [
      userId,
    ]);
    for (const b of bookings) {
      const ps = await query(
        "SELECT passenger_id FROM booking_passengers WHERE booking_id=?",
        [b.id],
      );
      for (const table of [
        "payments",
        "seat_assignments",
        "booking_passengers",
      ])
        await query("DELETE FROM " + table + " WHERE booking_id=?", [b.id]);
      await query("DELETE FROM bookings WHERE id=?", [b.id]);
      for (const p of ps)
        await query("DELETE FROM passengers WHERE id=?", [p.passenger_id]);
    }
    await query("DELETE FROM users WHERE id=?", [userId]);
  }
  await pool.end();
}


