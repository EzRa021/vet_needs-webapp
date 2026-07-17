// CSV export.
//
// Hand-rolled because the rules are small and the dependency isn't: quote
// anything containing a comma, quote or newline, and double any embedded
// quotes. Getting that wrong shifts every column after it.
function escape(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// columns: [{ key, label, format? }]
export function toCsv(rows, columns) {
  const header = columns.map((c) => escape(c.label)).join(',')
  const body = rows.map((row) =>
    columns
      .map((c) => escape(c.format ? c.format(row[c.key], row) : row[c.key]))
      .join(',')
  )
  // \r\n: Excel on Windows is the audience here, and it's what they'll open it in.
  return [header, ...body].join('\r\n')
}

export function downloadCsv(filename, rows, columns) {
  // BOM, deliberately: without it Excel reads UTF-8 as Latin-1 and every ₦
  // becomes "â‚¦". The file is correct either way; Excel just needs telling.
  const blob = new Blob(['﻿' + toCsv(rows, columns)], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
