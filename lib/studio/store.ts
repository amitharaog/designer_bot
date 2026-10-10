import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/lib/supabase";
import type { CallRecord } from "./types";

// Supabase when configured (table in supabase/studio.sql), otherwise a local JSON file for dev.
// The file fallback is NOT durable on serverless hosts: configure Supabase before deploying.
const hasSupabase = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
const FILE = path.join(process.cwd(), ".data", "studio-calls.json");

async function readFile(): Promise<Record<string, CallRecord>> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return {};
  }
}

let writeChain: Promise<unknown> = Promise.resolve();

export async function getCall(id: string): Promise<CallRecord | null> {
  if (hasSupabase()) {
    const { data, error } = await db().from("studio_calls").select("data").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data?.data as CallRecord) ?? null;
  }
  return (await readFile())[id] ?? null;
}

export async function saveCall(call: CallRecord): Promise<void> {
  if (hasSupabase()) {
    const { error } = await db().from("studio_calls").upsert({ id: call.id, started_at: call.started_at, data: call });
    if (error) throw error;
    return;
  }
  writeChain = writeChain.then(async () => {
    const all = await readFile();
    all[call.id] = call;
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(all, null, 1));
  });
  await writeChain;
}

export async function listCalls(): Promise<CallRecord[]> {
  if (hasSupabase()) {
    const { data, error } = await db().from("studio_calls").select("data").order("started_at", { ascending: false }).limit(2000);
    if (error) throw error;
    return (data ?? []).map((r) => r.data as CallRecord);
  }
  return Object.values(await readFile()).sort((a, b) => b.started_at.localeCompare(a.started_at));
}
