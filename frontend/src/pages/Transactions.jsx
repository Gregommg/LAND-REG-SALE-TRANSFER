import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { transactionService } from "../api/services";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import Alert from "../components/Alert";
import "../styles/Transactions.css";

export default function Transactions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [detailsFor, setDetailsFor] = useState(null);
  const canDecide = ["registrar", "admin"].includes(user.role);

  async function fetchTransactions() {
    setLoading(true);
    try {
      const { data } = await transactionService.list();
      setTransactions(data);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load transactions." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function handleApprove(id) {
    setMessage(null);
    try {
      await transactionService.approve(id);
      setMessage({ type: "success", text: "Transaction approved. Ownership updated." });
      setDetailsFor(null);
      fetchTransactions();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to approve transaction." });
    }
  }

  async function handleReject(id) {
    const reason = window.prompt("Reason for rejection (optional):") || "";
    setMessage(null);
    try {
      await transactionService.reject(id, reason);
      setMessage({ type: "success", text: "Transaction rejected." });
      setDetailsFor(null);
      fetchTransactions();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to reject transaction." });
    }
  }

  async function handleConfirmPayment(id) {
    setMessage(null);
    try {
      await transactionService.confirmPayment(id);
      setMessage({ type: "success", text: "Payment receipt confirmed. A registrar can now finalize the sale." });
      setDetailsFor(null);
      fetchTransactions();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to confirm payment." });
    }
  }

  function messageCounterparty(t) {
    const otherUserId = t.seller_id === user.id ? t.buyer_id : t.seller_id;
    navigate(`/messages/${otherUserId}`);
  }

  return (
    <Layout>
      <div className="page-header">
        <h2>Sale &amp; Transfer Transactions</h2>
        <p>
          {canDecide
            ? "Review and approve or reject pending land sale and transfer applications."
            : "Track the status of your land sale and transfer applications."}
        </p>
      </div>

      <Alert type={message?.type} message={message?.text} onClose={() => setMessage(null)} />

      {loading ? (
        <p className="muted">Loading transactions...</p>
      ) : transactions.length === 0 ? (
        <p className="muted">No transactions found.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Parcel</th>
                <th>Type</th>
                <th>Seller</th>
                <th>Buyer</th>
                <th>Amount (KES)</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Initiated</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{t.parcel_number}<br /><span className="muted-small">{t.location}</span></td>
                  <td className="capitalize">{t.transaction_type}</td>
                  <td>{t.seller_name}</td>
                  <td>{t.buyer_name}</td>
                  <td>{Number(t.amount).toLocaleString()}</td>
                  <td>
                    {t.transaction_type === "sale" ? (
                      <>
                        <span className="capitalize">{t.payment_method?.replace("_", " ")}</span>
                        {t.status === "pending" && (
                          <>
                            <br />
                            <span className={`muted-small ${t.payment_confirmed_by_seller ? "" : "payment-pending-flag"}`}>
                              {t.payment_confirmed_by_seller ? "Payment confirmed" : "Payment not yet confirmed"}
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="muted-small">No payment (gift)</span>
                    )}
                  </td>
                  <td><StatusBadge status={t.status} /></td>
                  <td>{new Date(t.initiated_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-small btn-outline" onClick={() => setDetailsFor(t)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailsFor && (
        <div className="modal-overlay" onClick={() => setDetailsFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{detailsFor.parcel_number} &mdash; {detailsFor.transaction_type}</h3>

            <dl className="parcel-details">
              <div><dt>Amount</dt><dd>KES {Number(detailsFor.amount).toLocaleString()}</dd></div>
              <div><dt>Status</dt><dd><StatusBadge status={detailsFor.status} /></dd></div>
              {detailsFor.transaction_type === "sale" && (
                <div><dt>Payment Method</dt><dd className="capitalize">{detailsFor.payment_method?.replace("_", " ")}</dd></div>
              )}
            </dl>

            <div className="contact-block">
              <div>
                <strong>Seller</strong>
                <p>{detailsFor.seller_name}</p>
                <p className="muted-small">{detailsFor.seller_phone} &middot; {detailsFor.seller_email}</p>
              </div>
              <div>
                <strong>Buyer</strong>
                <p>{detailsFor.buyer_name}</p>
                <p className="muted-small">{detailsFor.buyer_phone} &middot; {detailsFor.buyer_email}</p>
              </div>
            </div>

            {detailsFor.transaction_type === "sale" && detailsFor.status === "pending" && (
              <p className="field-hint">
                Arrange payment via {detailsFor.payment_method === "bank_transfer" ? "bank transfer" : "cash"} using the
                contact details above. The seller confirms once they've received it, then a registrar can finalize the sale.
              </p>
            )}

            <div className="modal-actions modal-actions-wrap">
              {(detailsFor.seller_id === user.id || detailsFor.buyer_id === user.id) && (
                <button className="btn btn-outline" onClick={() => messageCounterparty(detailsFor)}>
                  Message {detailsFor.seller_id === user.id ? "Buyer" : "Seller"}
                </button>
              )}

              {detailsFor.seller_id === user.id &&
                detailsFor.transaction_type === "sale" &&
                detailsFor.status === "pending" &&
                !detailsFor.payment_confirmed_by_seller && (
                  <button className="btn btn-success" onClick={() => handleConfirmPayment(detailsFor.id)}>
                    Confirm Payment Received
                  </button>
                )}

              {canDecide && detailsFor.status === "pending" && (
                <>
                  <button className="btn btn-success" onClick={() => handleApprove(detailsFor.id)}>
                    Approve
                  </button>
                  <button className="btn btn-danger" onClick={() => handleReject(detailsFor.id)}>
                    Reject
                  </button>
                </>
              )}

              <button className="btn btn-outline" onClick={() => setDetailsFor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
