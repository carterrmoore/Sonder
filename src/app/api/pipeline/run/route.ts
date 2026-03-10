/**
 * POST /api/pipeline/run
 *
 * Triggers a pipeline run for a given city and category.
 * Request body:
 *   { city_id: string, category: Category }           — single category
 *   { city_id: string, run_all: true }                 — all 5 categories sequentially
 *
 * This route is not user-facing — it is called by the founder directly
 * (or eventually by a scheduled job). Protect it with the PIPELINE_SECRET env var.
 *
 * Returns the PipelineRunSummary (single) or PipelineRunAllSummary (run_all).
 * Long-running: do not use this behind a serverless timeout < 5 minutes.
 * For production runs, call from a long-running Node process or background job.
 */

import { NextRequest, NextResponse } from "next/server";
import { runPipeline, runPipelineAll } from "@/pipeline/index";
import type { Category } from "@/types/pipeline";

const VALID_CATEGORIES: Category[] = [
  "restaurant",
  "cafe",
  "accommodation",
  "tour",
  "sight",
  "nightlife",
];

export async function POST(req: NextRequest) {
  // ── Auth: simple shared secret for pipeline trigger ──────────────────────
  const authHeader = req.headers.get("authorization");
  const secret = process.env.PIPELINE_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "PIPELINE_SECRET not configured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse and validate body ───────────────────────────────────────────────
  let body: {
    city_id?: string;
    category?: string;
    run_all?: boolean;
    // TEST MODE ONLY — never ship this to production.
    // Caps candidate count entering Gate 0 for low-cost integration testing.
    test_mode?: boolean;
    max_candidates?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { city_id, category, run_all } = body;
  const testMode = body.test_mode === true;
  const maxCandidates = testMode ? (body.max_candidates ?? 10) : undefined;

  if (!city_id || typeof city_id !== "string") {
    return NextResponse.json(
      { error: "city_id is required and must be a string" },
      { status: 400 }
    );
  }

  // ── Run all categories ──────────────────────────────────────────────────
  if (run_all === true) {
    console.log(`[/api/pipeline/run] Triggered: city=${city_id}, run_all=true`);

    try {
      const summary = await runPipelineAll(city_id);
      return NextResponse.json({ success: true, summary }, { status: 200 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[/api/pipeline/run] Pipeline (run_all) failed:`, message);
      return NextResponse.json(
        { error: "Pipeline failed", detail: message },
        { status: 500 }
      );
    }
  }

  // ── Run single category ─────────────────────────────────────────────────
  if (!category || !VALID_CATEGORIES.includes(category as Category)) {
    return NextResponse.json(
      {
        error: `category must be one of: ${VALID_CATEGORIES.join(", ")} (or use run_all: true)`,
      },
      { status: 400 }
    );
  }

  console.log(
    `[/api/pipeline/run] Triggered: city=${city_id}, category=${category}` +
    (testMode ? ` [TEST MODE: max_candidates=${maxCandidates}]` : "")
  );

  try {
    const summary = await runPipeline(city_id, category as Category, { testMode, maxCandidates });
    return NextResponse.json({ success: true, summary }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[/api/pipeline/run] Pipeline failed:`, message);
    return NextResponse.json(
      { error: "Pipeline failed", detail: message },
      { status: 500 }
    );
  }
}
