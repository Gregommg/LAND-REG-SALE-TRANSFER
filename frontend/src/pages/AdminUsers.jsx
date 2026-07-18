import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { userService } from "../api/services";
import { openPdfBlob } from "../utils/openPdfBlob";
import { uploadsUrl } from "../utils/uploadsUrl";
import Layout from "../components/Layout";
import Alert from "../components/Alert";
import "../styles/Admin.css";

const ROLES = ["admin", "registrar", "citizen", "auditor"];
const STAFF_ROLES = ["admin", "registrar", "auditor"];

const newUserInitial = {
  fullName: "",
  email: "",
  password: "",
  nationalId: "",
  phoneNumber: "",
  role: "registrar",
};

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser.role === "admin";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser] = useState(newUserInitial);

  async function fetchUsers() {
    setLoading(true);
    try {
      const { data } = await userService.list();
      setUsers(data);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load users." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const pendingUsers = users.filter((u) => u.verification_status === "pending");
  const otherUsers = users.filter((u) => u.verification_status !== "pending");

  async function handleViewIdDocument(id) {
    try {
      const { data } = await userService.getIdDocument(id);
      openPdfBlob(data);
    } catch (err) {
      setMessage({ type: "error", text: "Could not open the ID document." });
    }
  }

  async function handleVerify(id, decision) {
    const notes = decision === "rejected" ? window.prompt("Reason for rejection (optional):") || "" : undefined;
    setMessage(null);
    try {
      await userService.verify(id, decision, notes);
      setMessage({
        type: "success",
        text: decision === "approved" ? "Account approved. The citizen can now log in." : "Account verification rejected.",
      });
      fetchUsers();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to record the verification decision." });
    }
  }

  async function handleRoleChange(id, role) {
    try {
      await userService.updateRole(id, role);
      setMessage({ type: "success", text: "User role updated." });
      fetchUsers();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to update role." });
    }
  }

  async function handleStatusToggle(u) {
    try {
      await userService.updateStatus(u.id, !u.is_active);
      fetchUsers();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to update account status." });
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setMessage(null);
    try {
      await userService.create(newUser);
      setMessage({ type: "success", text: "Staff account created successfully." });
      setNewUser(newUserInitial);
      setShowForm(false);
      fetchUsers();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to create account." });
    }
  }

  return (
    <Layout>
      <div className="page-header page-header-row">
        <div>
          <h2>User Management</h2>
          <p>Review citizen identity verifications{isAdmin ? ", and manage accounts, roles and access." : "."}</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ New Staff Account"}
          </button>
        )}
      </div>

      <Alert type={message?.type} message={message?.text} onClose={() => setMessage(null)} />

      {isAdmin && showForm && (
        <form onSubmit={handleCreateUser} className="form-card form-grid">
          <div>
            <label htmlFor="fullName">Full Name</label>
            <input id="fullName" value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} required />
          </div>
          <div>
            <label htmlFor="newEmail">Email</label>
            <input id="newEmail" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
          </div>
          <div>
            <label htmlFor="newPassword">Temporary Password</label>
            <input id="newPassword" type="password" minLength={6} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
          </div>
          <div>
            <label htmlFor="newRole">Role</label>
            <select id="newRole" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="newNationalId">National ID</label>
            <input id="newNationalId" value={newUser.nationalId} onChange={(e) => setNewUser({ ...newUser, nationalId: e.target.value })} />
          </div>
          <div>
            <label htmlFor="newPhone">Phone Number</label>
            <input id="newPhone" value={newUser.phoneNumber} onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })} required />
          </div>
          <button type="submit" className="btn btn-primary form-full">Create Account</button>
        </form>
      )}

      <section className="admin-section">
        <h3>Pending Identity Verifications</h3>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : pendingUsers.length === 0 ? (
          <p className="muted">No accounts are currently awaiting verification.</p>
        ) : (
          <div className="table-wrapper admin-page">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>National ID</th>
                  <th>Documents</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.profile_photo_path ? (
                        <img className="admin-thumb" src={uploadsUrl(u.profile_photo_path)} alt={u.full_name} />
                      ) : (
                        <span className="muted-small">No photo</span>
                      )}
                    </td>
                    <td>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td>{u.national_id}</td>
                    <td>
                      {u.has_id_document ? (
                        <button className="btn btn-small btn-outline" onClick={() => handleViewIdDocument(u.id)}>
                          View ID Document
                        </button>
                      ) : (
                        <span className="muted-small">Not provided</span>
                      )}
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-small btn-success" onClick={() => handleVerify(u.id, "approved")}>
                          Approve
                        </button>
                        <button className="btn btn-small btn-danger" onClick={() => handleVerify(u.id, "rejected")}>
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
      </section>

      {isAdmin && (
        <section className="admin-section">
          <h3>All Accounts</h3>
          {loading ? (
            <p className="muted">Loading users...</p>
          ) : (
            <div className="table-wrapper admin-page">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Verification</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {otherUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.full_name}</td>
                      <td>{u.email}</td>
                      <td>
                        <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td>
                        <span className={`status-badge ${u.verification_status === "approved" ? "status-registered" : "status-disputed"}`}>
                          {u.verification_status}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${u.is_active ? "status-registered" : "status-disputed"}`}>
                          {u.is_active ? "active" : "suspended"}
                        </span>
                      </td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td>
                        <button className="btn btn-small btn-outline" onClick={() => handleStatusToggle(u)}>
                          {u.is_active ? "Suspend" : "Reactivate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </Layout>
  );
}
