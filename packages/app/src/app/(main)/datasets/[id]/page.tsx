import Link from "next/link";
import { notFound } from "next/navigation";

import { DatasetTable } from "@/components/DatasetTable";
import { fetchDatasetById } from "@/lib/datasets";

export const dynamic = "force-dynamic";

interface DatasetPageParams {
  id: string;
}

export default async function DatasetPage({
  params,
}: {
  params: Promise<DatasetPageParams>;
}) {
  const resolvedParams = await params;
  const datasetId = decodeURIComponent(resolvedParams.id);
  const dataset = await fetchDatasetById(datasetId);

  if (!dataset) {
    notFound();
  }

  const { filters, items, fetchedAt, expiresAt, totalPages } = dataset;

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] min-h-0 max-h-[calc(100vh-6rem)] w-full max-w-none flex-col gap-6 overflow-hidden px-6 pb-8">
      <header className="flex w-full flex-col gap-4 rounded-3xl border border-zinc-900/20 bg-zinc-950/10 px-6 py-5">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200 transition hover:text-white"
          >
            <span aria-hidden>←</span>
            <span>Back to chat</span>
          </Link>
        </div>
        <div className="flex w-full flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-indigo-100">
              Dataset Snapshot
            </h1>
            <p className="mt-1 text-sm text-indigo-200/80">{datasetId}</p>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-xs uppercase tracking-[0.3em] text-indigo-200/70 sm:grid-cols-4">
              <div>
                <dt className="text-indigo-300/80">Items</dt>
                <dd className="mt-1 text-lg tracking-normal text-indigo-100">
                  {items.length.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-indigo-300/80">Pages</dt>
                <dd className="mt-1 text-lg tracking-normal text-indigo-100">
                  {totalPages.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-indigo-300/80">Fetched At</dt>
                <dd className="mt-1 text-sm tracking-normal text-indigo-100">
                  {formatTimestamp(fetchedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-indigo-300/80">Expires At</dt>
                <dd className="mt-1 text-sm tracking-normal text-indigo-100">
                  {formatTimestamp(expiresAt)}
                </dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-col gap-2 text-sm text-indigo-200/80">
            <FilterGroup label="Genres" values={filters.genres} />
            <FilterGroup label="Platforms" values={filters.platforms} />
            <FilterGroup
              label="Parent Platforms"
              values={filters.parentPlatforms}
            />
            <FilterGroup label="Tags" values={filters.tags} />
            <DateRangeFilter
              from={filters.releasedFrom ?? null}
              to={filters.releasedTo ?? null}
            />
          </div>
        </div>
      </header>

      <section className="flex-1 min-h-0">
        <DatasetTable items={items} />
      </section>
    </div>
  );
}

function formatTimestamp(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function FilterGroup({ label, values }: { label: string; values: string[] }) {
  if (!values || values.length === 0) {
    return null;
  }
  return (
    <div>
      <span className="text-xs uppercase tracking-[0.3em] text-indigo-300/70">
        {label}
      </span>
      <p className="mt-1 text-sm leading-relaxed text-indigo-100">
        {values.join(", ")}
      </p>
    </div>
  );
}

function DateRangeFilter({
  from,
  to,
}: {
  from: string | null;
  to: string | null;
}) {
  if (!from && !to) {
    return null;
  }

  const formattedFrom =
    from && !Number.isNaN(new Date(from).getTime())
      ? new Date(from).toLocaleDateString()
      : "Unknown";
  const formattedTo =
    to && !Number.isNaN(new Date(to).getTime())
      ? new Date(to).toLocaleDateString()
      : "Latest";

  return (
    <div>
      <span className="text-xs uppercase tracking-[0.3em] text-indigo-300/70">
        Released Between
      </span>
      <p className="mt-1 text-sm leading-relaxed text-indigo-100">
        {formattedFrom} → {formattedTo}
      </p>
    </div>
  );
}
