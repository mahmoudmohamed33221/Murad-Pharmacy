// سيرفر صغير (Cloudflare Worker) بيستقبل صورة الروشتة/العلبة ويرجّع أسماء الأدوية.
// مفتاح Anthropic بيتحط كـ Secret هنا فقط، عمره ما يظهر في صفحة الموقع.
const SYSTEM = `You read photos of medicine boxes and doctor prescriptions (Arabic or English, may be handwritten).
Extract ONLY the medicine / product names that are visible (brand name, and the generic name if written).
Do not add dosing, advice, or anything not in the image.
Reply with JSON only, no other text: {"names":["name1","name2"]}. If nothing is readable reply {"names":[]}.`;

const json = (obj, status, cors) => new Response(JSON.stringify(obj), {status, headers: {...cors, "Content-Type": "application/json"}});

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const ok = allowed.length === 0 || allowed.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": allowed.length === 0 ? "*" : (ok ? origin : "null"),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };
    if (req.method === "OPTIONS") return new Response(null, {status: 204, headers: cors});
    if (req.method !== "POST") return json({error: "method"}, 405, cors);
    if (!ok) return json({error: "origin"}, 403, cors);

    let body;
    try { body = await req.json(); } catch { return json({error: "bad json"}, 400, cors); }
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.image || "");
    if (!m || m[2].length > 7_000_000) return json({error: "bad image"}, 400, cors);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {"content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
      body: JSON.stringify({
        model: env.MODEL || "claude-sonnet-5-5",
        max_tokens: 600,
        system: SYSTEM,
        messages: [{role: "user", content: [
          {type: "image", source: {type: "base64", media_type: m[1], data: m[2]}},
          {type: "text", text: "Extract the medicine names from this image."}
        ]}]
      })
    });
    if (!r.ok) return json({error: "upstream " + r.status}, 502, cors);
    const data = await r.json();
    const text = (data.content || []).map(c => c.text || "").join("");
    let names = [];
    try { names = JSON.parse((/\{[\s\S]*\}/.exec(text) || ["{}"])[0]).names || []; } catch {}
    names = [...new Set(names.map(n => String(n).trim()).filter(Boolean))].slice(0, 15);
    return json({names}, 200, cors);
  }
};
