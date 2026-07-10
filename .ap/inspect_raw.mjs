import fs from 'fs';
import readline from 'readline';

async function main() {
  const filePath = "C:/Users/PC/.gemini/antigravity/brain/acaa9291-68e3-4d1e-a3e2-fe610649a1c1/.system_generated/logs/transcript.jsonl";
  if (!fs.existsSync(filePath)) {
    console.log("File does not exist:", filePath);
    return;
  }
  const lines = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    lines.push(line);
  }
  
  console.log(`Last 30 lines of ${lines.length} total lines:`);
  for (let i = Math.max(0, lines.length - 30); i < lines.length; i++) {
    const parsed = JSON.parse(lines[i]);
    console.log(`Step ${parsed.step_index} (${parsed.type}):`);
    if (parsed.content) {
      console.log("Content:", parsed.content.slice(0, 300));
    }
    if (parsed.tool_calls) {
      console.log("Tool Calls:", JSON.stringify(parsed.tool_calls, null, 2));
    }
  }
}

main().catch(console.error);
