const $ = (s) => document.querySelector(s),
  page = document.body.dataset.page;
const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(n) / 100,
  );
const params = new URLSearchParams(location.search);
let session = { user: null };
async function api(path, method = "GET", body) {
  const r = await fetch("/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": session.csrf || "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error);
  return data;
}
function message(text, bad = false) {
  $("#message").className = "message" + (bad ? " error" : "");
  $("#message").textContent = text;
}
async function action(fn) {
  try {
    await fn();
  } catch (e) {
    message(e.message, true);
  }
}
function field(name, label, type = "text", value = "", extra = "") {
  return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra} required></label>`;
}
function flightCard(f) {
  return `<article class="card flight"><div><span class="eyebrow">${esc(f.number)}</span><br><strong>${esc(f.origin)} → ${esc(f.destination)}</strong><p class="muted">${esc(f.departure)} UTC</p></div><div><strong>${money(f.fare_cents)}</strong><p>${f.capacity - f.occupied} of ${f.capacity} seats available</p></div><a class="button" href="flight-details.html?id=${f.id}">View departure</a></article>`;
}
async function start() {
  session = await api("/session");
  $("#account").innerHTML = session.user
    ? `<span>${esc(session.user.name)}</span> <button class="secondary" id="logout">Log out</button>`
    : '<a href="login.html">Log in</a> <a href="register.html">Create account</a>';
  if (session.user?.role === "admin")
    $("#admin-link").classList.remove("hidden");
  $("#logout")?.addEventListener("click", () =>
    action(async () => {
      await api("/logout", "POST");
      location.href = "index.html";
    }),
  );
  if (
    [
      "booking",
      "confirmation",
      "my-bookings",
      "admin",
      "admin-flights",
      "admin-reservations",
      "admin-airports",
      "admin-aircraft",
      "analytics",
    ].includes(page) &&
    !session.user
  ) {
    location.href = "login.html";
    return;
  }
  if (
    (page.startsWith("admin") || page === "analytics") &&
    session.user.role !== "admin"
  ) {
    message("Administrator access required.", true);
    return;
  }
  if (page === "index" || page === "flights") {
    const airports = await api("/airports");
    for (const n of ["origin", "destination"])
      $(`[name=${n}]`).innerHTML = airports
        .map(
          (a) =>
            `<option value="${a.code}">${esc(a.city)} (${a.code})</option>`,
        )
        .join("");
    $("[name=origin]").value = params.get("origin") || "ATL";
    $("[name=destination]").value = params.get("destination") || "JFK";
    $("[name=date]").value =
      params.get("date") ||
      new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    $("#search").onsubmit = (e) => {
      e.preventDefault();
      location.href =
        "flights.html?" + new URLSearchParams(new FormData(e.target));
    };
    if (page === "flights") {
      const rows = await api("/flights?" + params);
      $("#results").innerHTML = rows.length
        ? rows.map(flightCard).join("")
        : '<div class="card empty">No matching departures. Try another route or date.</div>';
    }
  }
  if (page === "login" || page === "register")
    $("#auth").onsubmit = (e) => {
      e.preventDefault();
      action(async () => {
        const data = Object.fromEntries(new FormData(e.target));
        await api("/" + page, "POST", data);
        if (page === "register") {
          location.href = "login.html?registered=1";
        } else {
          location.href = "my-bookings.html";
        }
      });
    };
  if (page === "login" && params.has("registered"))
    message("Account created. Log in to book your flight.");
  if (page === "flight-details") {
    const f = await api("/flights/" + params.get("id"));
    $("#details").innerHTML =
      `<div class="card"><span class="badge">${esc(f.status)}</span><h2>${esc(f.number)} · ${esc(f.origin)} → ${esc(f.destination)}</h2><p>Departure ${esc(f.departure)} UTC<br>Arrival ${esc(f.arrival)} UTC</p><p>${esc(f.model)} · ${f.capacity - f.occupied} seats available</p><p class="summary-total">${money(f.fare_cents)} <small>per passenger</small></p><p>One-way economy. Seat selection included. All fares and payments are simulated.</p>${f.status === "scheduled" && f.capacity > f.occupied ? `<a class="button" href="booking.html?id=${f.id}">Choose passengers and seats</a>` : "<p>Not available for booking.</p>"}</div>`;
  }
  if (page === "booking") {
    const f = await api("/flights/" + params.get("id"));
    $("#flight-summary").innerHTML =
      `<h2>${esc(f.origin)} → ${esc(f.destination)}</h2><p>${esc(f.number)} · ${esc(f.departure)} UTC</p><p>${money(f.fare_cents)} per passenger</p><div id="total" class="summary-total"></div><small>No card details needed. Use fictional names.</small>`;
    function draw() {
      const count = Number($("#count").value);
      $("#passengers").innerHTML = Array.from(
        { length: count },
        (_, i) =>
          `<section class="passenger"><h3>Passenger ${i + 1}</h3>${field("name" + i, "Full name", "text", "", 'maxlength="80"')}<p>Choose a seat</p><div class="seat-grid">${f.seats.map((s) => `<label><input aria-label="Passenger ${i + 1} seat ${esc(s.label)}" type="radio" name="seat${i}" value="${s.id}" ${s.occupied ? "disabled" : ""} required>${esc(s.label)}</label>`).join("")}</div></section>`,
      ).join("");
      $("#total").textContent = money(f.fare_cents * count);
    }
    $("#count").onchange = draw;
    draw();
    $("#booking").onsubmit = (e) => {
      e.preventDefault();
      action(async () => {
        const form = new FormData(e.target),
          passengers = Array.from(
            { length: Number($("#count").value) },
            (_, i) => ({
              name: form.get("name" + i),
              seat_id: Number(form.get("seat" + i)),
            }),
          );
        $("#confirm").disabled = true;
        try {
          const b = await api("/bookings", "POST", {
            instance_id: f.id,
            passengers,
          });
          location.href = "confirmation.html?reference=" + b.reference;
        } finally {
          $("#confirm").disabled = false;
        }
      });
    };
  }
  if (page === "confirmation" || page === "my-bookings") {
    async function load(reference = "") {
      const bookings = await api(
        "/bookings" +
          (reference ? "?reference=" + encodeURIComponent(reference) : ""),
      );
      $("#bookings").innerHTML = bookings.length
        ? bookings
            .map(
              (b) =>
                `<article class="card"><span class="badge">${esc(b.status)}</span><h2>${esc(b.origin)} → ${esc(b.destination)}</h2><p>${esc(b.number)} · ${esc(b.departure)} UTC</p><p>Booking reference <strong>${esc(b.reference)}</strong></p><p>${b.passengers.map((p) => `${esc(p.name)} · seat ${esc(p.label)}`).join("<br>")}</p><p class="summary-total">${money(b.total_cents)}</p><small>Simulated payment ${b.status === "cancelled" ? "voided" : "recorded"}. Not a real ticket.</small><div class="inline print-button"><button class="secondary" data-print>Print confirmation</button>${b.status === "confirmed" ? `<button class="danger" data-cancel="${b.id}">Cancel booking</button>` : ""}</div></article>`,
            )
            .join("")
        : '<div class="card empty">No bookings found. Search for your first flight.</div>';
      document
        .querySelectorAll("[data-print]")
        .forEach((b) => (b.onclick = () => window.print()));
      document.querySelectorAll("[data-cancel]").forEach(
        (b) =>
          (b.onclick = () => {
            if (confirm("Cancel this booking and release all its seats?"))
              action(async () => {
                await api("/bookings/" + b.dataset.cancel + "/cancel", "POST");
                await load(reference);
                message("Booking cancelled.");
              });
          }),
      );
    }
    await load(params.get("reference") || "");
    $("#lookup")?.addEventListener("submit", (e) => {
      e.preventDefault();
      action(() => load(new FormData(e.target).get("reference")));
    });
  }
  if (page.startsWith("admin") || page === "analytics") await loadAdmin();
}
async function loadAdmin() {
  if (page === "analytics") {
    const d = await api("/admin/analytics");
    const k = d.kpi,
      total = d.routes.reduce((s, r) => s + Number(r.capacity), 0),
      used = d.routes.reduce((s, r) => s + Number(r.occupied), 0);
    $("#analytics").innerHTML = `<section class="kpis">${[
      ["Net booked value", money(k.revenue_cents)],
      ["Reservations", k.bookings],
      [
        "Cancellation rate",
        k.bookings
          ? ((100 * k.cancellations) / k.bookings).toFixed(1) + "%"
          : "0%",
      ],
      [
        "Scheduled occupancy",
        total ? ((100 * used) / total).toFixed(1) + "%" : "0%",
      ],
    ]
      .map(
        ([label, value]) =>
          `<article class="card kpi"><small>${label}</small><strong>${value}</strong></article>`,
      )
      .join(
        "",
      )}</section><div class="grid"><section class="card"><h2>Occupancy by route</h2>${d.routes.map((r) => `<div class="chart-row"><b>${r.origin}–${r.destination}</b><div class="bar"><span style="width:${Number(r.capacity) ? (100 * r.occupied) / r.capacity : 0}%"></span></div><small>${Number(r.capacity) ? ((100 * r.occupied) / r.capacity).toFixed(1) : 0}%</small></div>`).join("")}</section><section class="card"><h2>Integrity checks</h2>${Object.entries(
      d.quality,
    )
      .map(
        ([name, value]) =>
          `<p><span class="badge">${value === 0 ? "PASS" : "REVIEW"}</span> ${esc(name.replaceAll("_", " "))}: ${value}</p>`,
      )
      .join(
        "",
      )}<p class="muted">Counts should be zero. These checks flag inconsistencies; they do not replace transaction tests.</p></section></div><section class="card table-wrap"><h2>Route performance</h2><table><thead><tr><th>Route</th><th>Departures</th><th>Seats</th><th>Occupied</th><th>Net booked value</th></tr></thead><tbody>${d.routes.map((r) => `<tr><td>${r.origin} → ${r.destination}</td><td>${r.departures}</td><td>${r.capacity}</td><td>${r.occupied}</td><td>${money(r.revenue_cents)}</td></tr>`).join("")}</tbody></table></section><section class="card table-wrap"><h2>Booking month trends</h2><table><thead><tr><th>Booking month</th><th>Bookings</th><th>Cancellations</th><th>Net booked value</th></tr></thead><tbody>${d.monthly.map((r) => `<tr><td>${esc(r.month)}</td><td>${r.bookings}</td><td>${r.cancellations}</td><td>${money(r.revenue_cents)}</td></tr>`).join("")}</tbody></table><p class="muted">Cancellations are attributed to the booking creation month.</p></section><p class="muted">${esc(d.scope)} Net booked value excludes cancelled bookings and is not recognized airline revenue.</p><a class="button" href="/api/admin/analytics.csv">Download route CSV</a>`;
    return;
  }
  if (page === "admin-reservations") {
    const rows = await api("/admin/reservations");
    $("#reservations").innerHTML = rows.length
      ? `<div class="table-wrap"><table><thead><tr><th>Reference</th><th>Customer</th><th>Flight</th><th>Fare</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map((b) => `<tr><td>${esc(b.reference)}</td><td>${esc(b.email)}</td><td>${esc(b.number)}</td><td>${money(b.total_cents)}</td><td>${esc(b.status)}</td><td>${b.status === "confirmed" ? `<button class="danger" data-admin-cancel="${b.id}">Cancel</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`
      : "No reservations yet.";
    document.querySelectorAll("[data-admin-cancel]").forEach(
      (b) =>
        (b.onclick = () => {
          if (confirm("Cancel this customer reservation?"))
            action(async () => {
              await api(
                "/admin/reservations/" + b.dataset.adminCancel + "/cancel",
                "POST",
                {},
              );
              await loadAdmin();
            });
        }),
    );
    return;
  }
  const d = await api("/admin/catalog");
  if (page === "admin") {
    $("#overview").innerHTML = `<section class="kpis">${[
      ["Airports", d.airports.length],
      ["Aircraft", d.aircraft.length],
      ["Flight definitions", d.flights.length],
      ["Recent departures", d.instances.length],
    ]
      .map(
        ([n, v]) =>
          `<article class="card kpi"><small>${n}</small><strong>${v}</strong></article>`,
      )
      .join(
        "",
      )}</section><div class="card"><h2>Keep operations in sync.</h2><p>Create airports and aircraft first, define a route, then schedule a dated departure. Changing a fare affects new bookings only. Cancelling a departure releases seats and voids its simulated payments.</p><a class="button" href="analytics.html">Explore reservation analytics</a></div>`;
    return;
  }
  const option = (rows, value, label) =>
    rows
      .map((r) => `<option value="${esc(r[value])}">${esc(label(r))}</option>`)
      .join("");
  if (page === "admin-airports") {
    $("#records").innerHTML = d.airports
      .map(
        (a) =>
          `<form class="card stack record" data-path="airports/${a.code}"><h2>${a.code}</h2>${field("name", "Airport name", "text", a.name)}${field("city", "City", "text", a.city)}${field("timezone", "IANA timezone", "text", a.timezone)}<button>Save airport</button></form>`,
      )
      .join("");
  }
  if (page === "admin-aircraft") {
    $("#records").innerHTML = d.aircraft
      .map(
        (a) =>
          `<form class="card stack record" data-path="aircraft/${a.id}"><h2>${a.registration} · ${a.capacity} seats</h2>${field("registration", "Registration", "text", a.registration)}${field("model", "Model", "text", a.model)}<button>Save aircraft</button></form>`,
      )
      .join("");
  }
  if (page === "admin-flights") {
    $("[name=origin]").innerHTML = option(
      d.airports,
      "code",
      (a) => a.code + " · " + a.city,
    );
    $("[name=destination]").innerHTML = option(
      d.airports,
      "code",
      (a) => a.code + " · " + a.city,
    );
    $("[name=flight_id]").innerHTML = option(
      d.flights,
      "id",
      (f) => f.number + " " + f.origin + "–" + f.destination,
    );
    $("[name=aircraft_id]").innerHTML = option(
      d.aircraft,
      "id",
      (a) => a.registration + " · " + a.capacity + " seats",
    );
    $("#records").innerHTML = d.instances
      .slice()
      .reverse()
      .map(
        (i) =>
          `<form class="card record inline" data-path="instances/${i.id}"><div><b>${esc(i.number)} · ${esc(i.origin)} → ${esc(i.destination)}</b><p>${esc(i.departure)} UTC</p></div>${field("fare_cents", "Fare in cents", "number", i.fare_cents, 'min="1" max="10000000"')}<label>Status<select name="status"><option ${i.status === "scheduled" ? "selected" : ""}>scheduled</option><option ${i.status === "cancelled" ? "selected" : ""}>cancelled</option></select></label><button>Update departure</button></form>`,
      )
      .join("");
  }
  document.querySelectorAll("form[data-create]").forEach(
    (f) =>
      (f.onsubmit = (e) => {
        e.preventDefault();
        action(async () => {
          await api(
            "/admin/" + f.dataset.create,
            "POST",
            Object.fromEntries(new FormData(f)),
          );
          f.reset();
          await loadAdmin();
          message("Record created.");
        });
      }),
  );
  document.querySelectorAll("form.record").forEach(
    (f) =>
      (f.onsubmit = (e) => {
        e.preventDefault();
        action(async () => {
          const b = Object.fromEntries(new FormData(f));
          if (
            b.status === "cancelled" &&
            !confirm("Cancel this departure and all its reservations?")
          )
            return;
          await api("/admin/" + f.dataset.path, "PUT", b);
          await loadAdmin();
          message("Record updated.");
        });
      }),
  );
}
action(start);
