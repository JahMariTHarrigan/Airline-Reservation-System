import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { config } from "../src/db.js";
import { hash } from "../src/security.js";
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12)
  throw Error("Set DEMO_PASSWORD to at least 12 characters before setup.");
const c = await mysql.createConnection({ ...config, multipleStatements: true });
try {
  await c.query("SET time_zone = '+00:00'");
  await c.query(
    await readFile(new URL("../schema.sql", import.meta.url), "utf8"),
  );
  await c.query(
    await readFile(new URL("../seed.sql", import.meta.url), "utf8"),
  );
  for (const [name, email, role] of [
    ["Demo Customer", "customer@example.test", "customer"],
    ["Demo Administrator", "admin@example.test", "admin"],
  ])
    await c.execute(
      "INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)",
      [name, email, await hash(password), role],
    );
  for (let a = 1; a <= 2; a++)
    for (let r = 1; r <= 6; r++)
      for (const letter of "ABCD")
        await c.execute("INSERT INTO seats(aircraft_id,label) VALUES (?,?)", [
          a,
          r + letter,
        ]);
  const stamp = (d) => d.toISOString().slice(0, 19).replace("T", " ");
  for (let day = 1; day <= 30; day++)
    for (let f = 1; f <= 6; f++) {
      const depart = new Date();
      depart.setUTCDate(depart.getUTCDate() + day);
      depart.setUTCHours(8 + (f - 1) * 2, 0, 0, 0);
      await c.execute(
        "INSERT INTO flight_instances(flight_id,aircraft_id,departure,arrival,fare_cents) VALUES (?,?,?,?,?)",
        [
          f,
          (f % 2) + 1,
          stamp(depart),
          stamp(new Date(+depart + 90 * 60000)),
          (110 + f * 25) * 100,
        ],
      );
    }
  console.log(
    "Created schema, 4 airports, 2 aircraft, 48 seats, 6 routes, 180 departures and two demo accounts.",
  );
} finally {
  await c.end();
}
