import React from "react";

interface Column {
  header: string;
  className?: string;
}

interface EntityTableProps {
  columns: Column[];
  children: React.ReactNode;
  caption?: string;
}

export function EntityTable({ columns, children, caption }: EntityTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className={`px-4 py-3 ${col.className ?? ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">{children}</tbody>
      </table>
    </div>
  );
}

interface EntityTableRowProps {
  children: React.ReactNode;
  className?: string;
}

export function EntityTableRow({ children, className }: EntityTableRowProps) {
  return (
    <tr className={`transition hover:bg-gray-50 ${className ?? ""}`}>
      {children}
    </tr>
  );
}

interface EntityTableCellProps {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}

export function EntityTableCell({ children, className, colSpan }: EntityTableCellProps) {
  return (
    <td colSpan={colSpan} className={`px-4 py-3 ${className ?? ""}`}>
      {children}
    </td>
  );
}
