import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { landService, transactionService } from "../api/services";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import Alert from "../components/Alert";
import "../styles/LandSearch.css";

const isStaffRole = (role) => ["admin", "registrar", "auditor"].includes(role);

export default function LandSearch() {
  const { user } = useAuth();
  const isStaff = isStaffRole(user.role);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // modal = { type: 'sell' | 'list' | 'buy' | 'history', parcel }
  const [modal, setModal] = useState(null);
  const [buyerId, setBuyerId] = useState("");
  const [transactionType, setTransactionType] = useState("sale");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [askingPrice, setAskingPrice] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function fetchParcels() {
    setLoading(true);
    try {
      const params = {};
      if (query) params.q = query;
      if (status) params.status = status;
      const { data } = await landService.list(params);
      setParcels(data);
    } catch (err) {
      console.error("Failed to load land records:", err);
      setMessage({
        type: "error",
        text: err.response?.data?.message
          ? `Failed to load land records: ${err.response.data.message}`
          : "Failed to load land records. Check that the backend server and database are running.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchParcels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearchSubmit(e) {
    e.preventDefault();
    fetchParcels();
  }

  function closeModal() {
    setModal(null);
    setBuyerId("");
    setTransactionType("sale");
    setAmount("");
    setPaymentMethod("bank_transfer");
    setAskingPrice("");
    setHistory([]);
  }

  function openModal(type, parcel) {
    setMessage(null);
    if (type === "buy") {
      setAmount(parcel.asking_price || "");
    }
    if (type === "history") {
      setHistoryLoading(true);
      landService
        .history(parcel.id)
        .then(({ data }) => setHistory(data))
        .catch(() => setMessage({ type: "error", text: "Failed to load transfer history." }))
        .finally(() => setHistoryLoading(false));
    }
    setModal({ type, parcel });
  }

  async function handlePrivateSaleSubmit(e) {
    e.preventDefault();
    setMessage(null);
    try {
      await transactionService.create({
        parcelId: modal.parcel.id,
        buyerId: Number(buyerId),
        transactionType,
        amount: transactionType === "transfer" ? Number(amount || 0) : Number(amount),
        ...(transactionType === "sale" ? { paymentMethod } : {}),
      });
      setMessage({ type: "success", text: `${transactionType === "sale" ? "Sale" : "Transfer"} initiated. Awaiting registrar approval.` });
      closeModal();
      fetchParcels();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to initiate transaction." });
    }
  }

  async function handleListSubmit(e) {
    e.preventDefault();
    setMessage(null);
    try {
      await landService.listForSale(modal.parcel.id, Number(askingPrice));
      setMessage({ type: "success", text: "Parcel listed for sale." });
      closeModal();
      fetchParcels();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to list parcel for sale." });
    }
  }

  async function handleUnlist(parcel) {
    setMessage(null);
    try {
      await landService.unlist(parcel.id);
      setMessage({ type: "success", text: "Parcel removed from the market." });
      fetchParcels();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to unlist parcel." });
    }
  }

  async function handleBuySubmit(e) {
    e.preventDefault();
    setMessage(null);
    try {
      await transactionService.create({
        parcelId: modal.parcel.id,
        transactionType: "sale",
        amount: Number(amount),
        paymentMethod,
      });
      setMessage({ type: "success", text: "Purchase request submitted. Awaiting seller payment confirmation and registrar approval." });
      closeModal();
      fetchParcels();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to submit purchase request." });
    }
  }

  function viewOnMap(parcel) {
    window.open(`https://www.google.com/maps?q=${parcel.latitude},${parcel.longitude}`, "_blank", "noopener");
  }

  return (
    <Layout>
      <div className="page-header">
        <h2>Search Land Records</h2>
        <p>Search the centralized land database by parcel number, location or title deed number.</p>
      </div>

      <Alert type={message?.type} message={message?.text} onClose={() => setMessage(null)} />

      <form className="search-bar" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          placeholder="Search by parcel number, location or title deed..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="registered">Registered</option>
          <option value="for_sale">For Sale</option>
          <option value="under_transfer">Under Transfer</option>
          <option value="transferred">Transferred</option>
          <option value="disputed">Disputed</option>
        </select>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      {loading ? (
        <p className="muted">Loading land records...</p>
      ) : parcels.length === 0 ? (
        <p className="muted">No land records match your search.</p>
      ) : (
        <div className="parcel-grid">
          {parcels.map((p) => {
            const isOwner = p.owner_id === user.id;
            const canManage = isOwner || isStaff;
            const canFacilitateTransfer = isOwner || ["admin", "registrar"].includes(user.role);
            const hasLocation = p.latitude !== null && p.longitude !== null;

            return (
              <div className="parcel-card" key={p.id}>
                <div className="parcel-card-header">
                  <h4>{p.parcel_number}</h4>
                  <StatusBadge status={p.status} />
                </div>
                <p className="parcel-location">{p.location}, {p.county}</p>

                <dl className="parcel-details">
                  <div><dt>Size</dt><dd>{p.size_acres} acres</dd></div>
                  <div><dt>Land Use</dt><dd className="capitalize">{p.land_use}</dd></div>
                  <div><dt>Title Deed</dt><dd>{p.title_deed_number || "—"}</dd></div>
                  <div><dt>Owner</dt><dd>{p.owner_name}</dd></div>
                  {p.asking_price && (
                    <div><dt>Asking Price</dt><dd>KES {Number(p.asking_price).toLocaleString()}</dd></div>
                  )}
                </dl>

                <div className="parcel-actions">
                  {p.status === "for_sale" && !isOwner && !isStaff && (
                    <button className="btn btn-success btn-small" onClick={() => openModal("buy", p)}>
                      Buy Now
                    </button>
                  )}
                  {p.status === "registered" && isOwner && (
                    <button className="btn btn-outline btn-small" onClick={() => openModal("list", p)}>
                      List for Sale
                    </button>
                  )}
                  {p.status === "for_sale" && isOwner && (
                    <button className="btn btn-outline btn-small" onClick={() => handleUnlist(p)}>
                      Unlist
                    </button>
                  )}
                  {["registered", "for_sale"].includes(p.status) && canFacilitateTransfer && (
                    <button className="btn btn-outline btn-small" onClick={() => openModal("sell", p)}>
                      Sell / Transfer To...
                    </button>
                  )}
                  {p.status === "registered" && canManage && (
                    <Link className="btn btn-outline btn-small" to={`/land/${p.id}/title-deed`}>
                      Title Deed
                    </Link>
                  )}
                  <button className="btn btn-outline btn-small" onClick={() => openModal("history", p)}>
                    History
                  </button>
                  {hasLocation && (
                    <button className="btn btn-outline btn-small" onClick={() => viewOnMap(p)}>
                      View on Map
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal?.type === "sell" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Sell / Transfer &mdash; {modal.parcel.parcel_number}</h3>
            <form onSubmit={handlePrivateSaleSubmit} className="modal-form">
              <label htmlFor="txType">Type</label>
              <select id="txType" value={transactionType} onChange={(e) => setTransactionType(e.target.value)}>
                <option value="sale">Sale</option>
                <option value="transfer">Transfer (e.g. to a relative, no money involved)</option>
              </select>

              <label htmlFor="buyerId">Buyer / Recipient User ID</label>
              <input
                id="buyerId"
                type="number"
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                placeholder="e.g. 4"
                required
              />

              {transactionType === "sale" ? (
                <>
                  <label htmlFor="amount">Amount (KES)</label>
                  <input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 2500000"
                    min="0"
                    required
                  />

                  <label htmlFor="paymentMethod">Payment Method</label>
                  <select id="paymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                  </select>
                  <p className="field-hint">
                    Once initiated, you and the buyer can see each other's contact details to arrange
                    payment. You'll need to confirm you've received it before a registrar can finalize the sale.
                  </p>
                </>
              ) : (
                <p className="field-hint">
                  This is a no-money transfer (e.g. gifting land to family). No payment or amount is needed.
                </p>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Application</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal?.type === "list" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>List for Sale &mdash; {modal.parcel.parcel_number}</h3>
            <form onSubmit={handleListSubmit} className="modal-form">
              <label htmlFor="askingPrice">Asking Price (KES)</label>
              <input
                id="askingPrice"
                type="number"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                placeholder="e.g. 3000000"
                min="1"
                required
              />
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">List Publicly</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal?.type === "buy" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Buy &mdash; {modal.parcel.parcel_number}</h3>
            <p className="muted-small">You will become the buyer in this transaction, subject to registrar approval.</p>
            <form onSubmit={handleBuySubmit} className="modal-form">
              <label htmlFor="buyAmount">Offer Amount (KES)</label>
              <input
                id="buyAmount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                required
              />
              <label htmlFor="buyPaymentMethod">Payment Method</label>
              <select id="buyPaymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
              </select>
              <p className="field-hint">
                Once submitted, you and the seller can see each other's contact details to arrange
                payment. The seller must confirm receipt before a registrar can finalize the sale.
              </p>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-success">Confirm Purchase</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal?.type === "history" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Transfer History &mdash; {modal.parcel.parcel_number}</h3>
            {historyLoading ? (
              <p className="muted">Loading history...</p>
            ) : history.length === 0 ? (
              <p className="muted">No sale or transfer history for this parcel yet.</p>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Seller</th>
                      <th>Buyer</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td>{new Date(h.initiated_at).toLocaleDateString()}</td>
                        <td className="capitalize">{h.transaction_type}</td>
                        <td>{h.seller_name}</td>
                        <td>{h.buyer_name}</td>
                        <td>{Number(h.amount).toLocaleString()}</td>
                        <td><StatusBadge status={h.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
