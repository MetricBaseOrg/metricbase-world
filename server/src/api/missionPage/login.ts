// Login screen for Mission Center. Separate document from the console so an
// unauthenticated visitor never downloads the app shell.

import { MISSION_CSS } from "./styles.js";

export const MISSION_LOGIN_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Mission Center</title>
<style>${MISSION_CSS}</style>
</head>
<body>
<div class="login-wrap">
  <form class="login-card" id="form" autocomplete="on">
    <h1>🛰️ Mission Center</h1>
    <p class="muted small">MetricBase World — operators only.</p>

    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="username" required />

    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required />

    <div class="row" style="margin-top:14px;">
      <button class="btn primary" id="submit" type="submit">Sign in</button>
    </div>
    <div class="err" id="err"></div>
  </form>
</div>
<script>
const form = document.getElementById("form");
const err = document.getElementById("err");
const submit = document.getElementById("submit");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  err.textContent = "";
  submit.disabled = true;
  try {
    const res = await fetch("/api/mission/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      err.textContent = data.error || "Sign-in failed.";
      submit.disabled = false;
      return;
    }
    window.location.href = "/mission";
  } catch {
    err.textContent = "Network error — is the server up?";
    submit.disabled = false;
  }
});
</script>
</body>
</html>`;
