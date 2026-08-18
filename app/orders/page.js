'use client';

import { useState } from 'react';
import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import LoadingCard from '@/components/ui/LoadingCard';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { useApi } from '@/lib/client/useApi';
import { formatMoney } from '@/lib/util/money';

function OrdersView() {
  const [page, setPage] = useState(1);
  const [creditOnly, setCreditOnly] = useState(false);
  const { data, loading, error, reload } = useApi(
    `/api/orders?page=${page}&creditOnly=${creditOnly}`
  );

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Orders CreditLoop has seen, and how much store credit each one used."
        actions={
          <div className="btn-group btn-group-sm">
            <button
              type="button"
              className={`btn ${!creditOnly ? 'btn-cl-primary' : 'btn-cl-secondary'}`}
              onClick={() => {
                setCreditOnly(false);
                setPage(1);
              }}
            >
              All orders
            </button>
            <button
              type="button"
              className={`btn ${creditOnly ? 'btn-cl-primary' : 'btn-cl-secondary'}`}
              onClick={() => {
                setCreditOnly(true);
                setPage(1);
              }}
            >
              Used credit
            </button>
          </div>
        }
      />

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading ? (
        <LoadingCard rows={6} />
      ) : data?.orders?.length ? (
        <div className="cl-card">
          <div className="cl-table-wrap">
            <table className="cl-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="text-end">Total</th>
                  <th className="text-end">Credit used</th>
                  <th className="text-end">Refund</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order.orderGid}>
                    <td className="fw-semibold">
                      {order.orderName || order.orderGid.split('/').pop()}
                    </td>
                    <td>{order.customerName || '—'}</td>
                    <td className="text-end cl-num">
                      {formatMoney(order.total, order.currencyCode)}
                    </td>
                    <td className="text-end cl-num">
                      {order.creditUsed > 0 ? (
                        <span className="cl-money-in">
                          {formatMoney(order.creditUsed, order.currencyCode)} credit
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-end cl-num">
                      {order.refund
                        ? formatMoney(order.refund.refundAmount, order.refund.currencyCode)
                        : '—'}
                    </td>
                    <td>
                      <span
                        className={`cl-pill ${
                          order.isRepeatPurchase ? 'cl-pill-green' : 'cl-pill-muted'
                        }`}
                      >
                        {order.isRepeatPurchase ? 'Repeat' : 'First order'}
                      </span>
                    </td>
                    <td className="cl-source-note">
                      {new Date(order.createdAt).toLocaleDateString()}
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
            title="No orders yet"
            message="Orders appear here as Shopify sends them to CreditLoop, along with any store credit they used."
          />
        </div>
      )}
    </>
  );
}

export default function OrdersPage() {
  return (
    <Page>
      <OrdersView />
    </Page>
  );
}
