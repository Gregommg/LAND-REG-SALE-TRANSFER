import { useEffect, useState } from "react";
import { landService } from "../api/services";
import { openPdfBlob } from "../utils/openPdfBlob";
import Layout from "../components/Layout";
import Alert from "../components/Alert";
import "../styles/Admin.css";

export default function LandApprovals() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  async function fetchRequests() {
    setLoading(true);
    try {
      const { data } = await landService.list({ status: "pending" });
      setRequests(data);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load pending registration requests." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  async function handleApprove(id) {
    setMessage(null);
    try {
      await landService.approve(id);
      setMessage({ type: "success", text: "Land registration approved. The parcel is now active." });
      fetchRequests();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to approve request." });
    }
  }

  async function handleReject(id) {
    const reason = window.prompt("Reason for rejection (optional):") || "";
    setMessage(null);
    try {
      await landService.reject(id, reason);
      setMessage({ type: "success", text: "Land registration request rejected." });
      fetchRequests();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to reject request." });
    }
  }

  async function handleViewTitleDeed(id) {
    setMessage(null);
    try {
      const { data } = await landService.getTitleDeedDocument(id);
      openPdfBlob(data);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Could not open the title deed document." });
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <h2>Pending Land Registrations</h2>
        <p>Review self-submitted land registration requests and approve or reject them before they become official records.</p>
      </div>

      <Alert type={message?.type} message={message?.text} onClose={() => setMessage(null)} />

      {loading ? (
        <p className="muted">Loading pending requests...</p>
      ) : requests.length === 0 ? (
        <p className="muted">There are no pending land registration requests.</p>
      ) : (
        <div className="table-wrapper admin-page">
          <table className="data-table">
            <thead>
              <tr>
                <th>Parcel No.</th>
                <th>Requested By</th>
                <th>Location</th>
                <th>Size (acres)</th>
                <th>Land Use</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.parcel_number}</td>
                  <td>{r.owner_name}<br /><span className="muted-small">{r.owner_email}</span></td>
                  <td>{r.location}, {r.county}</td>
                  <td>{r.size_acres}</td>
                  <td className="capitalize">{r.land_use}</td>
                  <td>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-small btn-outline" onClick={() => handleViewTitleDeed(r.id)}>
                        View Title Deed
                      </button>
                      <button className="btn btn-small btn-success" onClick={() => handleApprove(r.id)}>
                        Approve
                      </button>
                      <button className="btn btn-small btn-danger" onClick={() => handleReject(r.id)}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
