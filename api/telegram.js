/**
 * GET /api/telegram?u=<username>
 *
 * Resolves publicly available metadata for a PUBLIC Telegram channel or group
 * by reading the Open Graph tags that Telegram already serves on t.me pages.
 *
 * No API key, no bot token, no third-party service. Only publicly accessible
 * HTML is read, and only for public @usernames — private invite hashes
 * (t.me/+...) are rejected outright.
 *
 * Response: { ok: true, username, title, description, image, kind, members,
 *             memberLabel, verified }
 *        or { ok: false, reason }
 */

const USERNAME_RE = /^[A-Za-z0-9_]{4,32}$/;
const UPSTREAM = "https://t.me/";
const TIMEOUT_MS = 7000;

/* Node 18+ on Vercel ships a global fetch. Keep a clear error otherwise. */
const hasFetch = typeof fetch === "function";

module.exports = async function handler(req, res) {
  /* -------- Cache: 1h at the edge, a day of stale-while-revalidate ------ */
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Vary", "Accept-Encoding");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, reason: "method_not_allowed" });
  }

  if (!hasFetch) {
    return res.status(200).json({ ok: false, reason: "runtime_unsupported" });
  }

  /* -------- Validate input (also guards against SSRF) ------------------- */
  const raw = Array.isArray(req.query.u) ? req.query.u[0] : req.query.u;
  const username = String(raw || "").replace(/^@/, "").trim();

  if (!username) {
    return res.status(400).json({ ok: false, reason: "missing_username" });
  }

  if (!USERNAME_RE.test(username)) {
    // Covers t.me/+invite hashes and anything non-public.
    return res.status(200).json({ ok: false, reason: "not_public" });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let html;
  try {
    const upstream = await fetch(UPSTREAM + encodeURIComponent(username), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Telegram returns the full preview markup to a normal browser UA.
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9"
      }
    });

    if (!upstream.ok) {
      return res.status(200).json({ ok: false, reason: "upstream_" + upstream.status });
    }

    html = await upstream.text();
  } catch (err) {
    const aborted = err && (err.name === "AbortError" || err.code === "ABORT_ERR");
    return res.status(200).json({ ok: false, reason: aborted ? "timeout" : "upstream_unreachable" });
  } finally {
    clearTimeout(timer);
  }

  if (!html || html.length < 200) {
    return res.status(200).json({ ok: false, reason: "empty_upstream" });
  }

  /* -------- Parse ------------------------------------------------------- */
  const title = clean(meta(html, "og:title"));
  const description = clean(meta(html, "og:description"));
  const image = safeImage(meta(html, "og:image"));

  // A non-existent handle still returns a page, but its title is just "Telegram".
  if (!title || /^telegram$/i.test(title)) {
    return res.status(200).json({ ok: false, reason: "not_found" });
  }

  const extra = clean(
    firstMatch(html, /<div class="tgme_page_extra">([\s\S]*?)<\/div>/i)
  );

  const kind = /subscriber/i.test(extra) ? "channel"
             : /member/i.test(extra)     ? "group"
             : null;

  const memberLabel = kind === "channel" ? "subscribers"
                    : kind === "group"   ? "members"
                    : null;

  const members = parseCount(extra);

  const verified = /class="[^"]*verified[^"]*"/i.test(html);

  return res.status(200).json({
    ok: true,
    username,
    title,
    description: description || "",
    image: image || null,
    kind,
    members: members > 0 ? members : null,
    memberLabel,
    verified
  });
};

/* ---------------------------------------------------------------------------
   Helpers
   --------------------------------------------------------------------------- */

function firstMatch(html, re) {
  const m = html.match(re);
  return m && m[1] ? m[1] : "";
}

/**
 * Reads a <meta property|name="key" content="..."> value, tolerant of
 * attribute order and single/double quoting.
 */
function meta(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // content before property/name
  let m = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, "i")
  );
  if (m) return m[1];

  // property/name before content
  m = html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i")
  );
  return m ? m[1] : "";
}

/** Strips tags and decodes the handful of entities Telegram actually emits. */
function clean(value) {
  if (!value) return "";
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Only allow https images from Telegram's own CDN. */
function safeImage(url) {
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  const allowed =
    host === "telesco.pe" ||
    host.endsWith(".telesco.pe") ||
    host.endsWith(".cdn-telegram.org") ||
    host === "telegram.org";
  return allowed ? parsed.toString() : null;
}

/** "1 580 subscribers" → 1580 */
function parseCount(text) {
  if (!text) return 0;
  const m = String(text).replace(/[\s\u00A0]/g, "").match(/(\d[\d,.]*)/);
  if (!m) return 0;
  const digits = m[1].replace(/[,.]/g, "");
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}
