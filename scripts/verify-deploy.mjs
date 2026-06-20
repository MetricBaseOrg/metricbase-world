const clientUrl = process.argv[2];
const serverUrl = process.argv[3]?.replace(/\/$/, "");

if (!clientUrl || !serverUrl) {
  console.error("Usage: node scripts/verify-deploy.mjs <vercel-url> <railway-url>");
  process.exit(1);
}

const checks = [];

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({ name, ok: false, message });
    console.log(`✗ ${name}: ${message}`);
  }
}

await check("Vercel client returns HTML", async () => {
  const response = await fetch(clientUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  if (!html.includes("MetricBase World")) {
    throw new Error("page loaded but game title not found");
  }
});

await check("Railway health endpoint", async () => {
  const response = await fetch(`${serverUrl}/health`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body.status !== "ok") throw new Error(JSON.stringify(body));
});

await check("Railway character API", async () => {
  const response = await fetch(`${serverUrl}/api/character?name=DeployCheck`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (!body.name || body.zoneId === undefined) throw new Error(JSON.stringify(body));
});

const failed = checks.filter((entry) => !entry.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);