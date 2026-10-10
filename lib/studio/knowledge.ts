import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

const dir = (...p: string[]) => path.join(process.cwd(), "studio", ...p);
const MAX_EXAMPLES = 6;
const MAX_EXAMPLE_CHARS = 2500;

let cache: { docs: string; examples: string } | null = null;

/**
 * services.md + qualified.md (verbatim), and a few past enquiries as behaviour examples.
 * pricing.md is deliberately NOT loaded: the model never sees internal rates, so it can't leak or paraphrase them.
 */
export async function loadKnowledge() {
  if (cache) return cache;
  // qualified.md has one example rupee figure for a budget mismatch; strip it so the model has no number to repeat.
  const read = async (f: string) => (await fs.readFile(dir("knowledge", f), "utf8")).replace(/₹[\d.–-]+\s*lakh/g, "a very small amount");
  const [services, qualified] = await Promise.all([read("services.md"), read("qualified.md")]);
  const docs = [
    `<services>\n${services}\n</services>`,
    `<qualification_rubric>\n${qualified}\n</qualification_rubric>`,
  ].join("\n\n");

  let examples = "";
  try {
    const files = (await fs.readdir(dir("enquiries"))).filter((f) => /\.(txt|md|json)$/i.test(f) && !/^readme/i.test(f)).sort();
    const picked = files.slice(0, MAX_EXAMPLES);
    const texts = await Promise.all(picked.map(async (f) => (await fs.readFile(dir("enquiries", f), "utf8")).slice(0, MAX_EXAMPLE_CHARS)));
    if (texts.length) examples = texts.map((t, i) => `<example_enquiry n="${i + 1}">\n${t}\n</example_enquiry>`).join("\n");
  } catch {}
  cache = { docs, examples };
  return cache;
}
