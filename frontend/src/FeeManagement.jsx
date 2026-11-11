import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from './api.js'

async function readData(response) {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const validationMessage = Object.values(result.errors || {}).flat()[0]
    throw new Error(validationMessage || result.message || 'That request could not be completed.')
  }
  return result.data
}

function currentAcademicYear() {
  const year = new Date().getFullYear()
  return `${year}-${year + 1}`
}

function formatAmount(amount) {
  return Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function FeeManagement({ school }) {
  const [open, setOpen] = useState(false)
  const [academicYear, setAcademicYear] = useState(currentAcademicYear)
  const [standardYears] = useState(() => {
    const year = new Date().getFullYear()
    return Array.from({ length: 6 }, (_, index) => `${year - 2 + index}-${year - 1 + index}`)
  })
  const [feeTypes, setFeeTypes] = useState([])
  const [invoices, setInvoices] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [studentId, setStudentId] = useState('')
  const [feeTypeId, setFeeTypeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [editingFeeTypeId, setEditingFeeTypeId] = useState(null)
  const [editFeeTitle, setEditFeeTitle] = useState('')
  const [editFeeAmount, setEditFeeAmount] = useState('')
  const [payments, setPayments] = useState({})
  const [busyKey, setBusyKey] = useState('')

  const refreshData = useCallback(async (signal) => {
    const query = `academic_year=${encodeURIComponent(academicYear)}`
    const [feeTypeResponse, invoiceResponse, studentResponse] = await Promise.all([
      apiRequest(`/api/schools/${school.id}/fee-types?${query}`, signal ? { signal } : undefined),
      apiRequest(`/api/schools/${school.id}/fee-invoices?${query}`, signal ? { signal } : undefined),
      apiRequest(`/api/schools/${school.id}/students?${query}`, signal ? { signal } : undefined),
    ])
    const [feeTypeData, invoiceData, studentData] = await Promise.all([
      readData(feeTypeResponse),
      readData(invoiceResponse),
      readData(studentResponse),
    ])
    setFeeTypes(feeTypeData)
    setInvoices(invoiceData)
    setStudents(studentData.filter((student) => student.status === 'active'))
    setFeeTypeId((current) => current && feeTypeData.some((feeType) => String(feeType.id) === current && feeType.status === 'active')
      ? current
      : String(feeTypeData.find((feeType) => feeType.status === 'active')?.id || ''))
    setStudentId((current) => current && studentData.some((student) => String(student.id) === current && student.status === 'active')
      ? current
      : String(studentData.find((student) => student.status === 'active')?.id || ''))
  }, [academicYear, school.id])

  useEffect(() => {
    if (!open) return undefined
    const controller = new AbortController()

    async function loadFees() {
      setLoading(true)
      setError('')
      try {
        await refreshData(controller.signal)
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadFees()
    return () => controller.abort()
  }, [open, academicYear, refreshData])

  const academicYears = [...new Set([
    ...feeTypes.map((feeType) => feeType.academic_year),
    ...invoices.map((invoice) => invoice.academic_year),
    ...standardYears,
  ])].sort((left, right) => right.localeCompare(left))

  async function createFeeType(event) {
    event.preventDefault()
    setError('')
    setBusyKey('fee-type')
    try {
      await readData(await apiRequest(`/api/schools/${school.id}/fee-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, amount, academic_year: academicYear }),
      }))
      setTitle('')
      setAmount('')
      await refreshData()
    } catch (createError) {
      setError(createError.message)
    } finally {
      setBusyKey('')
    }
  }

  async function issueInvoice(event) {
    event.preventDefault()
    setError('')
    setBusyKey('issue')
    try {
      await readData(await apiRequest(`/api/schools/${school.id}/fee-invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: Number(studentId), fee_type_id: Number(feeTypeId), academic_year: academicYear, due_date: dueDate || null }),
      }))
      setDueDate('')
      await refreshData()
    } catch (issueError) {
      setError(issueError.message)
    } finally {
      setBusyKey('')
    }
  }

  async function archiveFeeType(feeType) {
    setError('')
    setBusyKey(`fee-type-${feeType.id}`)
    try {
      await readData(await apiRequest(`/api/schools/${school.id}/fee-types/${feeType.id}`, { method: 'DELETE' }))
      await refreshData()
    } catch (archiveError) {
      setError(archiveError.message)
    } finally {
      setBusyKey('')
    }
  }

  async function saveFeeType(event, feeType) {
    event.preventDefault()
    setError('')
    setBusyKey(`fee-type-${feeType.id}`)
    try {
      await readData(await apiRequest(`/api/schools/${school.id}/fee-types/${feeType.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editFeeTitle, amount: editFeeAmount }),
      }))
      setEditingFeeTypeId(null)
      await refreshData()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusyKey('')
    }
  }

  async function restoreFeeType(feeType) {
    setError('')
    setBusyKey(`fee-type-${feeType.id}`)
    try {
      await readData(await apiRequest(`/api/schools/${school.id}/fee-types/${feeType.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      }))
      await refreshData()
    } catch (restoreError) {
      setError(restoreError.message)
    } finally {
      setBusyKey('')
    }
  }

  async function recordPayment(event, invoice) {
    event.preventDefault()
    setError('')
    setBusyKey(`payment-${invoice.id}`)
    try {
      await readData(await apiRequest(`/api/schools/${school.id}/fee-invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: payments[invoice.id]?.amount || '', reference: payments[invoice.id]?.reference || null }),
      }))
      setPayments((current) => ({ ...current, [invoice.id]: { amount: '', reference: '' } }))
      await refreshData()
    } catch (paymentError) {
      setError(paymentError.message)
    } finally {
      setBusyKey('')
    }
  }

  async function voidInvoice(invoice) {
    setError('')
    setBusyKey(`invoice-${invoice.id}`)
    try {
      await readData(await apiRequest(`/api/schools/${school.id}/fee-invoices/${invoice.id}`, { method: 'DELETE' }))
      await refreshData()
    } catch (voidError) {
      setError(voidError.message)
    } finally {
      setBusyKey('')
    }
  }

  return (
    <div className="academic-structure">
      <button className="team-toggle" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {open ? 'Hide fee management' : 'Manage fees'}
      </button>
      {open ? (
        <div className="academic-panel fee-panel">
          <div className="academic-section-heading">
            <h4>Fees</h4>
            <label className="fee-year-filter" htmlFor={`fee-year-${school.id}`}>
              Academic year
              <select id={`fee-year-${school.id}`} value={academicYear} onChange={(event) => setAcademicYear(event.target.value)}>
                {academicYears.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {loading ? <p className="muted-copy" role="status">Loading fees…</p> : null}
          {!loading ? (
            <>
              <section aria-labelledby={`fee-items-heading-${school.id}`}>
                <div className="academic-section-heading"><h4 id={`fee-items-heading-${school.id}`}>Fee items</h4><span>{feeTypes.length}</span></div>
                <form className="fee-item-form" onSubmit={createFeeType}>
                  <label htmlFor={`fee-title-${school.id}`}>Fee item name</label>
                  <input id={`fee-title-${school.id}`} value={title} onChange={(event) => setTitle(event.target.value)} required />
                  <label htmlFor={`fee-amount-${school.id}`}>Amount</label>
                  <input id={`fee-amount-${school.id}`} type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
                  <button className="primary-button small-button" type="submit" disabled={busyKey === 'fee-type'}>Add fee item</button>
                </form>
                {feeTypes.length ? (
                  <ul className="fee-type-list">
                    {feeTypes.map((feeType) => (
                      <li key={feeType.id}>
                        {editingFeeTypeId === feeType.id ? (
                          <form className="fee-type-edit-form" onSubmit={(event) => saveFeeType(event, feeType)}>
                            <label className="visually-hidden" htmlFor={`edit-fee-title-${feeType.id}`}>Fee item name</label>
                            <input id={`edit-fee-title-${feeType.id}`} value={editFeeTitle} onChange={(event) => setEditFeeTitle(event.target.value)} required />
                            <label className="visually-hidden" htmlFor={`edit-fee-amount-${feeType.id}`}>Fee item amount</label>
                            <input id={`edit-fee-amount-${feeType.id}`} type="number" min="0.01" step="0.01" value={editFeeAmount} onChange={(event) => setEditFeeAmount(event.target.value)} required />
                            <button className="quiet-button" type="submit" disabled={busyKey === `fee-type-${feeType.id}`}>Save</button>
                            <button className="quiet-button" type="button" onClick={() => setEditingFeeTypeId(null)}>Cancel</button>
                          </form>
                        ) : (
                          <>
                            <span>{feeType.title} <small>{feeType.status}</small></span>
                            <strong>{formatAmount(feeType.amount)}</strong>
                            <button className="quiet-button" type="button" onClick={() => {
                              setEditFeeTitle(feeType.title)
                              setEditFeeAmount(feeType.amount)
                              setEditingFeeTypeId(feeType.id)
                            }}>Edit</button>
                            {feeType.status === 'active'
                              ? <button className="quiet-button danger-action" type="button" onClick={() => archiveFeeType(feeType)} disabled={busyKey === `fee-type-${feeType.id}`}>Archive</button>
                              : <button className="quiet-button" type="button" onClick={() => restoreFeeType(feeType)} disabled={busyKey === `fee-type-${feeType.id}`}>Restore</button>}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : <p className="muted-copy">No fee items for this academic year yet.</p>}
              </section>

              <section aria-labelledby={`issue-fee-heading-${school.id}`}>
                <div className="academic-section-heading"><h4 id={`issue-fee-heading-${school.id}`}>Issue a student invoice</h4></div>
                <form className="fee-issue-form" onSubmit={issueInvoice}>
                  <label htmlFor={`fee-student-${school.id}`}>Student</label>
                  <select id={`fee-student-${school.id}`} value={studentId} onChange={(event) => setStudentId(event.target.value)} required>
                    <option value="">Choose a student</option>
                    {students.map((student) => <option key={student.id} value={student.id}>{student.last_name}, {student.first_name} · {student.admission_number}</option>)}
                  </select>
                  <label htmlFor={`fee-type-${school.id}`}>Fee item</label>
                  <select id={`fee-type-${school.id}`} value={feeTypeId} onChange={(event) => setFeeTypeId(event.target.value)} required>
                    <option value="">Choose a fee item</option>
                    {feeTypes.filter((feeType) => feeType.status === 'active').map((feeType) => <option key={feeType.id} value={feeType.id}>{feeType.title} · {formatAmount(feeType.amount)}</option>)}
                  </select>
                  <label htmlFor={`fee-due-date-${school.id}`}>Due date <span>(optional)</span></label>
                  <input id={`fee-due-date-${school.id}`} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                  <button className="primary-button small-button" type="submit" disabled={busyKey === 'issue' || !students.length || !feeTypes.some((feeType) => feeType.status === 'active')}>Issue invoice</button>
                </form>
                {!students.length ? <p className="muted-copy">No active students are enrolled in {academicYear}.</p> : null}
              </section>

              <section aria-labelledby={`invoices-heading-${school.id}`}>
                <div className="academic-section-heading"><h4 id={`invoices-heading-${school.id}`}>Student invoices</h4><span>{invoices.length}</span></div>
                {invoices.length ? (
                  <ul className="fee-invoice-list">
                    {invoices.map((invoice) => (
                      <li key={invoice.id} className="fee-invoice-card">
                        <div className="fee-invoice-summary">
                          <strong>{invoice.student.last_name}, {invoice.student.first_name}</strong>
                          <span>{invoice.student.admission_number} · {invoice.fee_type.title} · {invoice.status}</span>
                          <span>Amount {formatAmount(invoice.amount)} · Paid {formatAmount(invoice.amount_paid)} · Balance {formatAmount(invoice.balance)}{invoice.due_date ? ` · Due ${invoice.due_date}` : ''}</span>
                        </div>
                        {invoice.status !== 'void' && Number(invoice.balance) > 0 ? (
                          <form className="fee-payment-form" onSubmit={(event) => recordPayment(event, invoice)}>
                            <label className="visually-hidden" htmlFor={`payment-amount-${invoice.id}`}>Payment amount for invoice {invoice.id}</label>
                            <input id={`payment-amount-${invoice.id}`} type="number" min="0.01" max={invoice.balance} step="0.01" placeholder="Amount" value={payments[invoice.id]?.amount || ''} onChange={(event) => setPayments((current) => ({ ...current, [invoice.id]: { ...current[invoice.id], amount: event.target.value } }))} required />
                            <label className="visually-hidden" htmlFor={`payment-reference-${invoice.id}`}>Payment reference for invoice {invoice.id}</label>
                            <input id={`payment-reference-${invoice.id}`} placeholder="Receipt reference (optional)" value={payments[invoice.id]?.reference || ''} onChange={(event) => setPayments((current) => ({ ...current, [invoice.id]: { ...current[invoice.id], reference: event.target.value } }))} />
                            <button className="primary-button small-button" type="submit" disabled={busyKey === `payment-${invoice.id}`}>Record payment</button>
                          </form>
                        ) : null}
                        {invoice.status !== 'void' && invoice.amount_paid === '0.00' ? <button className="quiet-button danger-action" type="button" onClick={() => voidInvoice(invoice)} disabled={busyKey === `invoice-${invoice.id}`}>Void invoice</button> : null}
                        {invoice.payments.length ? <details className="fee-payment-history"><summary>Payment history ({invoice.payments.length})</summary><ul>{invoice.payments.map((payment) => <li key={payment.id}>{formatAmount(payment.amount)} · {payment.paid_on}{payment.reference ? ` · ${payment.reference}` : ''}</li>)}</ul></details> : null}
                      </li>
                    ))}
                  </ul>
                ) : <p className="muted-copy">No invoices for {academicYear} yet.</p>}
              </section>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
