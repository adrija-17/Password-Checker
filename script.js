const $ = id => document.getElementById(id);
const COMMON = ["password","123456","qwerty","abc123","letmein","welcome","admin","iloveyou","monkey","dragon","111111","passw0rd","football","login"];

const RULES = [
  ["At least 12 characters", p => p.length >= 12],
  ["Contains a lowercase letter (a-z)", p => /[a-z]/.test(p)],
  ["Contains an uppercase letter (A-Z)", p => /[A-Z]/.test(p)],
  ["Contains a number (0-9)", p => /\d/.test(p)],
  ["Contains a symbol (! @ # $ ...)", p => /[^A-Za-z0-9]/.test(p)],
  ["No common words or easy patterns", p => !hasWeakPattern(p)]
];

const TIERS = [
  ["Very easy to crack", "This would fall in moments. Add more characters and mix in numbers and symbols to climb out of the green zone."],
  ["Easy to crack", "You're on your way. Try a longer password, 12 characters or more makes a big difference."],
  ["Possible to crack", "Getting there! Add a few more unusual characters or turn it into a longer passphrase."],
  ["Hard to crack", "Strong work. A little more length or variety and attackers will give up."],
  ["Nearly impossible to crack", "Excellent. This is the kind of password that keeps accounts safe."]
];

const list = $("rules");
RULES.forEach(([t]) => {
  const li = document.createElement("li");
  li.innerHTML = '<span class="box">✓</span><span>' + t + '</span>';
  list.appendChild(li);
});

function hasWeakPattern(p) {
  const l = p.toLowerCase();
  return COMMON.some(c => l.includes(c)) || /(.)\1{2,}/.test(p) ||
    /(abc|bcd|cde|123|234|345|456|567|678|789|qwe|asd|zxc)/i.test(p);
}

function entropy(p) {
  let pool = 0;
  if (/[a-z]/.test(p)) pool += 26;
  if (/[A-Z]/.test(p)) pool += 26;
  if (/\d/.test(p)) pool += 10;
  if (/[^A-Za-z0-9]/.test(p)) pool += 32;
  let bits = p.length * Math.log2(pool || 1);
  if (hasWeakPattern(p)) bits *= 0.6;
  return bits;
}

function crackTime(bits) {
  let s = Math.pow(2, bits) / 2 / 1e10; // 10 billion guesses per second
  if (s < 1) return "Cracked instantly";
  const steps = [[60, "seconds"], [60, "minutes"], [24, "hours"], [365, "days"]];
  let unit = "years";
  for (const [d, n] of steps) { if (s < d) { unit = n; break; } s /= d; }
  if (unit === "years" && s >= 1e6) return "Millions of years";
  return "About " + Math.round(s).toLocaleString() + " " + unit;
}

// ---------- Breach check (Have I Been Pwned, k-anonymity) ----------
let breachState = "idle", timer, token = 0;

async function sha1(text) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function checkBreach(p) {
  clearTimeout(timer);
  const my = ++token;
  if (!p) { setBreach("idle"); return; }
  setBreach("checking");
  timer = setTimeout(async () => {
    try {
      const h = await sha1(p);
      const res = await fetch("https://api.pwnedpasswords.com/range/" + h.slice(0, 5));
      if (!res.ok) throw new Error("bad response");
      const text = await res.text();
      if (my !== token) return;
      const hit = text.split("\n").map(l => l.trim().split(":")).find(([s]) => s === h.slice(5));
      setBreach(hit ? "breached" : "safe", hit ? Number(hit[1]).toLocaleString() : "");
    } catch (e) {
      if (my === token) setBreach("error");
    }
    update(true);
  }, 600);
}

function setBreach(state, count) {
  breachState = state;
  const el = $("breach");
  el.hidden = state === "idle";
  el.className = "breach " + ({ breached: "bad", safe: "ok" }[state] || "info");
  el.textContent = {
    checking: "Checking known data breaches…",
    safe: "✓ Not found in any known data breach.",
    breached: "⚠ This password appeared in data breaches " + count + " times. Attackers already have it. Choose a different one.",
    error: "Couldn't reach the breach database. Check your internet connection."
  }[state] || "";
}

// ---------- UI ----------
function update(skipBreach) {
  const p = $("pw").value;
  $("out").value = p;
  RULES.forEach(([, f], i) => list.children[i].classList.toggle("pass", !!p && f(p)));
  if (!skipBreach) checkBreach(p);

  const fill = $("fill");
  if (!p) {
    fill.style.width = "0";
    $("label").textContent = "Waiting for a password";
    $("label").style.color = "";
    $("time").textContent = "";
    $("msg").textContent = "Start typing and the meter will react. Longer is stronger.";
    $("congrats").hidden = true;
    return;
  }

  const bits = entropy(p);
  let score = Math.min(100, Math.round(bits));
  const breached = breachState === "breached";
  if (breached) score = Math.min(score, 15);

  const tier = score < 20 ? 0 : score < 40 ? 1 : score < 60 ? 2 : score < 80 ? 3 : 4;
  const hue = 120 - score * 1.2; // green (easy to crack) -> yellow -> red (impossible)
  fill.style.width = Math.max(score, 4) + "%";
  fill.style.background = "hsl(" + hue + ",85%,48%)";
  $("label").textContent = breached ? "Breached: easy to crack" : TIERS[tier][0];
  $("label").style.color = "hsl(" + hue + ",85%,55%)";
  $("time").textContent = breached ? "Already exposed" : crackTime(bits);
  $("msg").textContent = breached
    ? "Hackers already know this one. Pick something new, or let me generate a strong one for you."
    : TIERS[tier][1];

  const allPass = RULES.every(([, f]) => f(p));
  $("congrats").hidden = !(allPass && score >= 90 && breachState === "safe");
}

$("pw").addEventListener("input", () => update());

$("show").addEventListener("click", e => {
  const show = $("pw").type === "password";
  $("pw").type = $("out").type = show ? "text" : "password";
  e.target.textContent = show ? "Hide" : "Show";
  e.target.setAttribute("aria-pressed", show);
});

// Theme toggle
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  $("theme").textContent = t === "dark" ? "☀ Light" : "☾ Dark";
  $("theme").setAttribute("aria-label", "Switch to " + (t === "dark" ? "light" : "dark") + " mode");
  try { localStorage.setItem("theme", t); } catch (e) {}
}
let saved = "dark";
try { saved = localStorage.getItem("theme") || "dark"; } catch (e) {}
setTheme(saved);
$("theme").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

// Generator (asks permission first)
function rand(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function generate(len = 16) {
  const sets = ["abcdefghijkmnopqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "!@#$%^&*-_=+?"];
  const all = sets.join("");
  const chars = sets.map(s => s[rand(s.length)]);
  while (chars.length < len) chars.push(all[rand(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = rand(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}
$("help").addEventListener("click", () => { $("ask").hidden = false; $("yes").focus(); });
$("no").addEventListener("click", () => { $("ask").hidden = true; });
$("yes").addEventListener("click", () => {
  $("pw").value = generate();
  $("ask").hidden = true;
  update();
  $("copied").textContent = "Generated a strong password. Copy it below and store it safely.";
});

// Copy
$("copy").addEventListener("click", async () => {
  const v = $("out").value;
  if (!v) { $("copied").textContent = "Nothing to copy yet. Type or generate a password first."; return; }
  try {
    await navigator.clipboard.writeText(v);
  } catch (e) {
    const t = $("out"), old = t.type;
    t.type = "text"; t.select(); document.execCommand("copy"); t.type = old;
  }
  $("copied").textContent = "Copied to clipboard ✓";
  $("copy").textContent = "Copied!";
  setTimeout(() => { $("copy").textContent = "Copy"; }, 1800);
});
