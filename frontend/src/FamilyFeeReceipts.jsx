import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from './api.js'
import DataTools from './DataTools.jsx'

const receiptFields = [
  { key: 'source_parent_id', label: 'source_parent_id', required: true },
  { key: 'receipt_number', label: 'receipt_number', required: true },
  { key: 'source_key', label: 'source_key' },
  { key: 'receipt_date', label: 'receipt_date', required: true },
  { key: 'total_fee', label: 'total_fee' }, { key: 'discount', label: 'discount' },
  { key: 'arrears', label: 'arrears' }, { key: 'fund', label: 'fund' },
  { key: 'manual_discount', label: 'manual_discount' }, { key: 'total_payable', label: 'total_payable' },
  { key: 'received', label: 'received' }, { key: 'balance', label: 'balance' },
  { key: 'source_sheet', label: 'source_sheet' }, { key: 'source_row', label: 'source_row' }, { key: 'source_data', label: 'source_data' },
]

const exportFields = [
  ...receiptFields,
  { key: 'parent_name', label: 'parent_name' }, { key: 'parent_phone', label: 'parent_phone' },
]

function pagerPages(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1)
  const selected = new Set([1, pages, page, page - 1, page + 1].filter((value) => value > 0 && value <= pages))
  const ordered = [...selected].sort((left, right) => left - right)
  return ordered.flatMap((value, index) => index > 0 && value - ordered[index - 1] > 1 ? [`gap-${value}` , value] : [value])
}

function SortableHeader({ label, field, sort, onSort }) {
  const active = sort.key === field
  return <button className="expense-sort-button" type="button" onClick={() => onSort({ key: field, direction: active && sort.direction === 'asc' ? 'desc' : 'asc' })} aria-label={`Sort by ${label} ${active && sort.direction === 'asc' ? 'descending' : 'ascending'}`}>
    {label}<span aria-hidden="true">{active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
  </button>
}

function amount(value) {
  if (value === null || value === undefined || value === '') return '—'
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function FamilyFeeReceipts({ school, canManage = false }) {
  const [receipts, setReceipts] = useState([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: 'receipt_date', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function loadReceipts() {
    setLoading(true)
    setError('')
    try {
      const response = await apiRequest(`/api/schools/${school.id}/family-fee-receipts`)
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'Could not load family receipts.')
      setReceipts((result.data || []).map((receipt) => ({
        ...receipt,
        parent_name: receipt.guardian?.father_name || '',
        parent_phone: receipt.guardian?.father_phone || '',
      })))
    } catch (loadError) {
      setError(loadError.message || 'Could not load family receipts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadReceipts() }, [school.id])
  useEffect(() => { setPage(1) }, [search, pageSize])

  async function importReceipt(record) {
    setBusy(true)
    try {
      if (record.source_data) {
        try { record.source_data = JSON.parse(record.source_data) } catch { throw new Error('source_data must contain valid JSON.') }
      }
      const response = await apiRequest(`/api/schools/${school.id}/family-fee-receipts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        const validationMessage = Object.values(result.errors || {}).flat()[0]
        throw new Error(validationMessage || result.message || 'Receipt import failed.')
      }
      await loadReceipts()
    } finally {
      setBusy(false)
    }
  }

  const filteredReceipts = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const matching = receipts.filter((receipt) => Object.values(receipt).some((value) => String(value ?? '').toLowerCase().includes(needle)))
    const sorted = sort.key ? matching.toSorted((left, right) => {
      const first = left[sort.key] ?? ''
      const second = right[sort.key] ?? ''
      const numeric = first !== '' && second !== '' && !Number.isNaN(Number(first)) && !Number.isNaN(Number(second))
      const comparison = numeric ? Number(first) - Number(second) : String(first).localeCompare(String(second), undefined, { numeric: true, sensitivity: 'base' })
      return sort.direction === 'asc' ? comparison : -comparison
    }) : matching
    return sorted
  }, [receipts, search, sort])

  const pages = Math.max(1, Math.ceil(filteredReceipts.length / pageSize))
  const safePage = Math.min(page, pages)
  const visibleRows = filteredReceipts.slice((safePage - 1) * pageSize, safePage * pageSize)
  const first = filteredReceipts.length ? (safePage - 1) * pageSize + 1 : 0
  const last = Math.min(safePage * pageSize, filteredReceipts.length)

  return <section className="academic-panel expense-module family-fee-receipts">
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <header className="expense-page-heading"><div><p className="eyebrow">Finance</p><h2>Family fee receipts</h2><p>Historical receipts grouped by the parent account recorded in the source ledger.</p></div><span className="expense-record-count">{receipts.length.toLocaleString()} receipts</span></header>
    <section className="expense-card expense-list-card">
      <header><div><h3>Receipt ledger</h3><p>Receipt totals, discounts, arrears, payments and balances.</p></div></header>
      <div className="expense-list-toolbar">
        <label className="module-search expense-table-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search family fee receipts" placeholder="Search by parent, ID, phone, or receipt number" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <DataTools title="Family Fee Receipts" rows={receipts} fields={receiptFields} exportFields={exportFields} canImport={canManage} onImport={importReceipt} />
      </div>
      {loading ? <p className="muted-copy" role="status">Loading family receipts…</p> : <div className="crud-table-wrap"><table className="crud-table expense-table family-fee-receipt-table">
        <thead><tr>{[['receipt_number', 'Receipt number'], ['source_parent_id', 'Parent ID'], ['parent_name', 'Father / parent'], ['parent_phone', 'Contact'], ['receipt_date', 'Date'], ['total_fee', 'Fee'], ['discount', 'Discount'], ['arrears', 'Arrears'], ['fund', 'Fund'], ['manual_discount', 'Manual discount'], ['total_payable', 'Payable'], ['received', 'Received'], ['balance', 'Balance']].map(([key, label]) => <th key={key}><SortableHeader label={label} field={key} sort={sort} onSort={setSort} /></th>)}</tr></thead>
        <tbody>{visibleRows.map((receipt) => <tr key={receipt.id}>
          <td>{receipt.receipt_number}</td><td>{receipt.source_parent_id || '—'}</td><td>{receipt.parent_name || '—'}</td><td>{receipt.parent_phone || '—'}</td><td>{receipt.receipt_date}</td>
          <td>{amount(receipt.total_fee)}</td><td>{amount(receipt.discount)}</td><td>{amount(receipt.arrears)}</td><td>{amount(receipt.fund)}</td><td>{amount(receipt.manual_discount)}</td><td>{amount(receipt.total_payable)}</td><td>{amount(receipt.received)}</td><td>{amount(receipt.balance)}</td>
        </tr>)}{visibleRows.length === 0 ? <tr><td className="expense-empty-cell" colSpan="13">{search ? 'No receipts match this search.' : 'No family receipts have been recorded.'}</td></tr> : null}</tbody>
      </table></div>}
      {!loading ? <footer className="expense-table-footer"><span>Showing {first} to {last} of {filteredReceipts.length.toLocaleString()} receipts</span><label>Rows <select aria-label="Rows per page" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label><nav aria-label="Family fee receipt pagination"><button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>‹</button>{pagerPages(safePage, pages).map((item) => typeof item === 'string' ? <span className="student-pagination-ellipsis" key={item}>…</span> : <button type="button" key={item} className={safePage === item ? 'active' : ''} aria-current={safePage === item ? 'page' : undefined} onClick={() => setPage(item)}>{item}</button>)}<button type="button" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>›</button></nav></footer> : null}
      {busy ? <p className="muted-copy" role="status">Importing receipt…</p> : null}
    </section>
  </section>
}
