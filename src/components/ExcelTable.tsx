"use client"

import { useState } from "react"

interface Column {
  key: string
  label: string
  type?: "text" | "number" | "currency" | "date"
  editable?: boolean
  width?: string
}

interface ExcelTableProps {
  columns: Column[]
  data: Record<string, unknown>[]
  onEdit?: (rowIndex: number, key: string, value: string) => void
  onDelete?: (rowIndex: number) => void
  title?: string
  showRowNumbers?: boolean
}

export default function ExcelTable({
  columns,
  data,
  onEdit,
  onDelete,
  title,
  showRowNumbers = true,
}: ExcelTableProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null)

  const formatValue = (value: unknown, type?: string) => {
    if (value === null || value === undefined) return "—"
    if (type === "currency") return `Bs${Number(value).toFixed(2)}`
    if (type === "number") return Number(value).toLocaleString()
    if (type === "date" && typeof value === "string") {
      return new Date(value).toLocaleDateString("es-MX")
    }
    return String(value)
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
      {title && (
        <div className="bg-gray-800 text-white px-4 py-2 font-semibold text-sm flex items-center justify-between">
          <span>{title}</span>
          <span className="text-xs text-gray-400">{data.length} registros</span>
        </div>
      )}
      <div className="overflow-auto max-h-[70vh]">
        <table className="excel-table">
          <thead>
            <tr>
              {showRowNumbers && (
                <th className="w-10 text-center">#</th>
              )}
              {columns.map((col) => (
                <th key={col.key} style={{ width: col.width }}>
                  {col.label}
                </th>
              ))}
              {onDelete && <th className="w-16 text-center">Acc.</th>}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (showRowNumbers ? 1 : 0) + (onDelete ? 1 : 0)}
                  className="text-center py-8 text-gray-400"
                >
                  Sin datos
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {showRowNumbers && (
                    <td className="text-center text-gray-400 font-mono text-xs bg-gray-100">
                      {rowIdx + 1}
                    </td>
                  )}
                  {columns.map((col) => {
                    const isEditing =
                      editingCell?.row === rowIdx && editingCell?.col === col.key
                    return (
                      <td
                        key={col.key}
                        className={col.editable ? "editable cursor-pointer" : ""}
                        onDoubleClick={() => {
                          if (col.editable) {
                            setEditingCell({ row: rowIdx, col: col.key })
                          }
                        }}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            defaultValue={String(row[col.key] ?? "")}
                            onBlur={(e) => {
                              onEdit?.(rowIdx, col.key, e.target.value)
                              setEditingCell(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                onEdit?.(rowIdx, col.key, (e.target as HTMLInputElement).value)
                                setEditingCell(null)
                              }
                              if (e.key === "Escape") setEditingCell(null)
                            }}
                            className="w-full outline-none bg-transparent"
                          />
                        ) : (
                          <span
                            className={
                              col.type === "currency" || col.type === "number"
                                ? "font-mono"
                                : ""
                            }
                          >
                            {formatValue(row[col.key], col.type)}
                          </span>
                        )}
                      </td>
                    )
                  })}
                  {onDelete && (
                    <td className="text-center">
                      <button
                        onClick={() => onDelete(rowIdx)}
                        className="text-red-500 hover:text-red-700 text-xs"
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
