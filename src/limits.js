// keeps track of request limits in this server's memory
// if this runs on more than one server, theyll need a shared store
const attempts = new Map();
export function authLimit(req, res, next) {
  const now = Date.now(),
    key = req.ip;
  for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  const v = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  v.count++;
  attempts.set(key, v);
  if (v.count > 40)
    return res
      .status(429)
      .json({ error: "Too many sign-in attempts. Try again in 15 minutes." });
  next();
}
