import fs from 'fs';
import readline from 'readline';

async function main() {
  const filePath = "C:/Users/PC/.gemini/antigravity/brain/0d5bfbc4-48fe-4e95-a19c-ec9e27deeaac/.system_generated/logs/transcript.jsonl";
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const parsed = JSON.parse(line);
    // Let's check if the model called a tool containing "image" in its name
    if (parsed.tool_calls) {
      for (const call of parsed.tool_calls) {
        if (call.name.includes("image") || call.name.includes("mcp")) {
          console.log(`Step ${parsed.step_index} called tool: ${call.name}`);
          console.log(JSON.stringify(call, null, 2));
        }
      }
    }
    // Or if the step content contains npc_pip
    if (parsed.content && parsed.content.includes("npc_pip")) {
      console.log(`Step ${parsed.step_index} content includes npc_pip:`, parsed.content.slice(0, 200));
    }
  }
}

main().catch(console.error);
