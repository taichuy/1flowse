import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RunDiagnosticsPanel } from "@/components/run-diagnostics-panel";
import { getRunDetail } from "@/lib/get-run-detail";

type RunDiagnosticsPageProps = {
  params: Promise<{ runId: string }>;
};

export async function generateMetadata({
  params
}: RunDiagnosticsPageProps): Promise<Metadata> {
  const { runId } = await params;

  return {
    title: `Run ${runId} | 7Flows Studio`
  };
}

export default async function RunDiagnosticsPage({
  params
}: RunDiagnosticsPageProps) {
  const { runId } = await params;
  const run = await getRunDetail(runId);

  if (!run) {
    notFound();
  }

  return <RunDiagnosticsPanel run={run} />;
}
