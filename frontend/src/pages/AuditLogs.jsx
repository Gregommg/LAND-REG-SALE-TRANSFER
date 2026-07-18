import { useEffect, useState } from "react";
import { auditService } from "../api/services";
import Layout from "../components/Layout";
import Alert from "../components/Alert";
import "../styles/Admin.css";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [actionFilter, setActionFilter] = useState("");

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = {};
      if (actionFilter) params.action = actionFilter;
      const { data } = await auditService.list(params);
      setLogs(data);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load audit logs." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilterSubmit(e) {
    e.preventDefault();
    fetchLogs();
  }

  return (
    <Layout>
      <div className="page-header">
        <h2>Audit Logs</h2>
        <p>Traceability of sensitive actions performed across the system, for accountability and security review.</p>
      </div>

      <Alert type={message?.type} message={message?.text} onClose={() => setMessage(null)} />

      <form className="search-bar" onSubmit={handleFilterSubmit}>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="">All actions</option>
          <option value="LOGIN">Login</option>
          <option value="LOGIN_FAILED">Failed Login</option>
          <option value="REGISTER">Registration</option>
          <option value="PARCEL_CREATE">Parcel Created</option>
          <option value="PARCEL_UPDATE">Parcel Updated</option>
          <option value="PARCEL_APPROVE">Parcel Registration Approved</option>
          <option value="PARCEL_REJECT">Parcel Registration Rejected</option>
          <option value="PARCEL_LIST_FOR_SALE">Parcel Listed For Sale</option>
          <option value="PARCEL_UNLIST">Parcel Unlisted</option>
          <option value="PARCEL_DELETE">Parcel Deleted</option>
          <option value="TRANSACTION_CREATE">Transaction Initiated</option>
          <option value="PAYMENT_CONFIRM">Payment Confirmed by Seller</option>
          <option value="TRANSACTION_APPROVE">Transaction Approved</option>
          <option value="TRANSACTION_REJECT">Transaction Rejected</option>
          <option value="USER_CREATE">User Created</option>
          <option value="USER_ROLE_UPDATE">Role Updated</option>
          <option value="USER_STATUS_UPDATE">Status Updated</option>
          <option value="USER_VERIFY_APPROVE">Identity Verification Approved</option>
          <option value="USER_VERIFY_REJECT">Identity Verification Rejected</option>
          <option value="ID_DOCUMENT_VIEW">ID Document Viewed</option>
          <option value="TITLE_DEED_DOCUMENT_VIEW">Title Deed Document Viewed</option>
          <option value="PROFILE_PHOTO_UPDATE">Profile Photo Updated</option>
          <option value="MESSAGE_SEND">Message Sent</option>
        </select>
        <button className="btn btn-primary" type="submit">Filter</button>
      </form>

      {loading ? (
        <p className="muted">Loading audit logs...</p>
      ) : logs.length === 0 ? (
        <p className="muted">No audit log entries found.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString()}</td>
                  <td>{log.user_name || "System"}<br /><span className="muted-small">{log.user_email}</span></td>
                  <td><span className="audit-action">{log.action}</span></td>
                  <td>{log.details}</td>
                  <td className="muted-small">{log.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
