"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type { GameSummary } from "@game-data/db";

interface DatasetTableProps {
  items: GameSummary[];
}

const columns: ColumnDef<GameSummary>[] = [
  {
    accessorKey: "name",
    header: "Title",
    cell: ({ row }) => {
      const { name, slug } = row.original;
      const href = slug ? `https://rawg.io/games/${slug}` : undefined;
      return href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-indigo-200 transition hover:text-white hover:underline"
        >
          {name}
        </a>
      ) : (
        <span>{name}</span>
      );
    },
    size: 260,
    enableSorting: true,
  },
  {
    accessorKey: "released",
    header: "Released",
    cell: ({ getValue }) => {
      const value = getValue<string | null>();
      return value ? (
        <span>{new Date(value).toLocaleDateString()}</span>
      ) : (
        <span className="text-indigo-200/60">—</span>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: "metacritic",
    header: "Metacritic",
    cell: ({ getValue }) => {
      const value = getValue<number | null>();
      return typeof value === "number" ? (
        <span>{value}</span>
      ) : (
        <span className="text-indigo-200/60">—</span>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: "rating",
    header: "Rating",
    cell: ({ getValue }) => {
      const value = getValue<number | null>();
      return typeof value === "number" ? (
        <span>{value.toFixed(2)}</span>
      ) : (
        <span className="text-indigo-200/60">—</span>
      );
    },
    enableSorting: true,
  },
  {
    id: "genres",
    header: "Genres",
    cell: ({ row }) => {
      const genres = row.original.genres ?? [];
      return genres.length > 0 ? (
        <span>{genres.map((genre) => genre.name).join(", ")}</span>
      ) : (
        <span className="text-indigo-200/60">—</span>
      );
    },
    enableSorting: false,
  },
  {
    id: "platforms",
    header: "Platforms",
    cell: ({ row }) => {
      const platforms = row.original.platforms ?? [];
      const labels = platforms
        .map((entry) => entry.platform?.name)
        .filter((name): name is string => Boolean(name));
      return labels.length > 0 ? (
        <span>{labels.join(", ")}</span>
      ) : (
        <span className="text-indigo-200/60">—</span>
      );
    },
    enableSorting: false,
  },
];

export function DatasetTable({ items }: DatasetTableProps) {
  const data = useMemo(() => items, [items]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "metacritic", desc: true },
  ]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-zinc-900/20 bg-zinc-950">
      <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-indigo-500/20 text-left text-sm text-indigo-100">
          <thead className="sticky top-0 z-10 bg-zinc-950/95 text-xs uppercase tracking-[0.3em] text-indigo-200/80 backdrop-blur">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className="px-4 py-3 font-semibold"
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-2 text-indigo-200 transition hover:text-white"
                        >
                          <span>
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </span>
                          <SortIndicator direction={sortDirection} />
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-indigo-500/10">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-indigo-500/10 transition">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-6 text-center text-indigo-200/70"
                >
                  No games found for this dataset.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortIndicator({ direction }: { direction: false | "asc" | "desc" }) {
  if (!direction) {
    return (
      <span className="text-indigo-400/60" aria-hidden>
        ↕
      </span>
    );
  }
  return (
    <span className="text-indigo-200" aria-hidden>
      {direction === "asc" ? "↑" : "↓"}
    </span>
  );
}
