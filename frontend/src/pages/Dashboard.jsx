import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { landService, transactionService } from "../api/services";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import "../styles/Dashboard.css";

export default function Dashboard() {
  const { user } = useAuth();
  const [parcels, setParcels] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const isStaff = ["admin", "registrar", "auditor"].includes(user.role);

  useEffect(() => {
    async function loadData() {
      try {
        const parcelParams = isStaff ? {} : { ownerId: user.id };
        const [parcelsRes, txRes] = await Promise.all([
          landService.list(parcelParams),
          transactionService.list(),
        ]);
        setParcels(parcelsRes.data);
        setTransactions(txRes.data);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const pendingTx = transactions.filter((t) => t.status === "pending");
  const registeredParcels = parcels.filter((p) => p.status === "registered").length;
  const forSale = parcels.filter((p) => p.status === "for_sale").length;
  const pendingRegistrations = parcels.filter((p) => p.status === "pending").length;

  return (
    <Layout>
      <div className="page-header">
        <h2>Welcome back, {user.full_name.split(" ")[0]}</h2>
        <p>Here is an overview of land records and transactions relevant to your account.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{parcels.length}</span>
          <span className="stat-label">
            {isStaff ? "Total Land Parcels" : "Parcels You Own"}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{registeredParcels}</span>
          <span className="stat-label">Registered</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{forSale}</span>
          <span className="stat-label">Listed For Sale</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{pendingTx.length}</span>
          <span className="stat-label">Pending Transactions</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{pendingRegistrations}</span>
          <span className="stat-label">{isStaff ? "Pending Registrations" : "Your Pending Requests"}</span>
        </div>
      </div>

      <div className="dashboard-columns">
        <section className="panel">
          <div className="panel-header">
            <h3>Recent Land Parcels</h3>
            <Link to="/land-search" className="panel-link">View all</Link>
          </div>
          {loading ? (
            <p className="muted">Loading...</p>
          ) : parcels.length === 0 ? (
            <p className="muted">No land parcels found.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Parcel No.</th>
                  <th>Location</th>
                  <th>Size (acres)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {parcels.slice(0, 5).map((p) => (
                  <tr key={p.id}>
                    <td>{p.parcel_number}</td>
                    <td>{p.location}</td>
                    <td>{p.size_acres}</td>
                    <td><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h3>Recent Transactions</h3>
            <Link to="/transactions" className="panel-link">View all</Link>
          </div>
          {loading ? (
            <p className="muted">Loading...</p>
          ) : transactions.length === 0 ? (
            <p className="muted">No transactions found.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Parcel No.</th>
                  <th>Type</th>
                  <th>Amount (KES)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 5).map((t) => (
                  <tr key={t.id}>
                    <td>{t.parcel_number}</td>
                    <td className="capitalize">{t.transaction_type}</td>
                    <td>{Number(t.amount).toLocaleString()}</td>
                    <td><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </Layout>
  );
}
