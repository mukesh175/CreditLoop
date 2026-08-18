'use client';

import { useState } from 'react';
import Link from 'next/link';
import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import LoadingCard from '@/components/ui/LoadingCard';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { useApi } from '@/lib/client/useApi';
import { formatMoney } from '@/lib/util/money';

const SEGMENTS = [
  { id: '', label: 'All customers' },
  { id: 'CREDIT_HOLDERS', label: 'Credit holders' },
  { id: 'HIGH_CREDIT', label: 'High credit' },
  { id: 'UNUSED_CREDIT', label: 'Unused credit' },
  { id: 'EXPIRING_CREDIT', label: 'Expiring credit' },
  { id: 'REPEAT_CREDIT_USERS', label: 'Repeat credit users' },
  { id: 'HIGH_VALUE', label: 'High value' },
];

function CustomersView() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState('');
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useApi(
    `/api/customers?page=${page}&q=${encodeURIComponent(query)}&segment=${segment}`
  );

  return (
    <>
      <PageHeader title="Customers" subtitle="Who holds credit, and who is spending it." />

      <div className="d-flex flex-wrap gap-2 mb-3">
        <form
          className="flex-grow-1"
          style={{ maxWidth: 340 }}
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
            setPage(1);
          }}
        >
          <input
            type="search"
            className="form-control"
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search customers"
          />
        </form>

        <select
          className="form-select"
          style={{ maxWidth: 220 }}
          value={segment}
          onChange={(e) => {
            setSegment(e.target.value);
            setPage(1);
          }}
          aria-label="Customer segment"
        >
          {SEGMENTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading ? (
        <LoadingCard rows={6} />
      ) : data?.customers?.length ? (
        <div className="cl-card">
          {data.segment && (
            <div className="cl-card-header">
              <div>
                <h2 className="cl-card-title">{data.segment.label}</h2>
                <span className="cl-source-note">{data.segment.description}</span>
              </div>
            </div>
          )}
          <div className="cl-table-wrap">
            <table className="cl-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="text-end">Credit</th>
                  <th className="text-end">Orders</th>
                  <th className="text-end">Lifetime value</th>
                  <th>Last purchase</th>
                  <th>Credit status</th>
                </tr>
              </thead>
              <tbody>
                {data.customers.map((customer) => (
                  <tr key={customer.customerGid}>
                    <td>
                      <Link
                        href={`/customers/${encodeURIComponent(customer.customerGid)}`}
                        className="text-decoration-none fw-semibold"
                        style={{ color: 'var(--cl-navy)' }}
                      >
                        {customer.displayName || customer.customerGid.split('/').pop()}
                      </Link>
                    </td>
                    <td className="text-end cl-num fw-semibold">
                      {formatMoney(customer.balance || 0, customer.balanceCurrency || customer.currencyCode)}
                    </td>
                    <td className="text-end cl-num">{customer.orderCount}</td>
                    <td className="text-end cl-num">
                      {formatMoney(customer.lifetimeValue, customer.currencyCode)}
                    </td>
                    <td className="cl-source-note">
                      {customer.lastOrderAt
                        ? `${Math.floor(
                            (Date.now() - new Date(customer.lastOrderAt)) / 86400000
                          )} days ago`
                        : '—'}
                    </td>
                    <td>
                      <span
                        className={`cl-pill ${
                          customer.balance > 0 ? 'cl-pill-green' : 'cl-pill-muted'
                        }`}
                      >
                        {customer.balance > 0 ? 'Active' : 'No credit'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={data.pagination} onChange={setPage} />
        </div>
      ) : (
        <div className="cl-card">
          <EmptyState
            title="No customers found"
            message="Customer data syncs from Shopify shortly after install. Try a different search or segment."
          />
        </div>
      )}
    </>
  );
}

export default function CustomersPage() {
  return (
    <Page>
      <CustomersView />
    </Page>
  );
}
