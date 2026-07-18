import api from "./axios";

// ---- Auth ----------------------------------------------------------------
export const authService = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  // formData must contain: fullName, email, password, nationalId, phoneNumber,
  // photo (file), idDocument (file)
  register: (formData) => api.post("/auth/register", formData),
  getProfile: () => api.get("/auth/me"),
  // formData must contain: photo (file)
  updatePhoto: (formData) => api.put("/auth/me/photo", formData),
};

// ---- Land parcels ----------------------------------------------------------
export const landService = {
  list: (params) => api.get("/land", { params }),
  getById: (id) => api.get(`/land/${id}`),
  create: (payload) => api.post("/land", payload),
  update: (id, payload) => api.put(`/land/${id}`, payload),
  remove: (id) => api.delete(`/land/${id}`),
  approve: (id) => api.put(`/land/${id}/approve`),
  reject: (id, reason) => api.put(`/land/${id}/reject`, { reason }),
  listForSale: (id, askingPrice) => api.put(`/land/${id}/list`, { askingPrice }),
  unlist: (id) => api.put(`/land/${id}/unlist`),
  history: (id) => api.get(`/land/${id}/history`),
  // Protected route, so fetch as a blob (carries the auth header) rather
  // than linking to it directly.
  getTitleDeedDocument: (id) => api.get(`/land/${id}/title-deed-document`, { responseType: "blob" }),
};

// ---- Transactions (sale & transfer) -----------------------------------------
export const transactionService = {
  list: (params) => api.get("/transactions", { params }),
  getById: (id) => api.get(`/transactions/${id}`),
  create: (payload) => api.post("/transactions", payload),
  confirmPayment: (id) => api.put(`/transactions/${id}/confirm-payment`),
  approve: (id) => api.put(`/transactions/${id}/approve`),
  reject: (id, reason) => api.put(`/transactions/${id}/reject`, { reason }),
};

// ---- Users (admin / registrar) -------------------------------------------------
export const userService = {
  list: () => api.get("/users"),
  create: (payload) => api.post("/users", payload),
  updateRole: (id, role) => api.put(`/users/${id}/role`, { role }),
  updateStatus: (id, isActive) => api.put(`/users/${id}/status`, { isActive }),
  verify: (id, decision, notes) => api.put(`/users/${id}/verify`, { decision, notes }),
  // Fetches the applicant's ID/passport PDF as a blob so it can be opened in
  // a new tab - it's a protected route, so a plain <a href> won't carry the
  // auth header.
  getIdDocument: (id) => api.get(`/users/${id}/id-document`, { responseType: "blob" }),
};

// ---- Audit logs ---------------------------------------------------------------
export const auditService = {
  list: (params) => api.get("/audit-logs", { params }),
};

// ---- Private messaging (encrypted at rest) -------------------------------------
export const messageService = {
  listConversations: () => api.get("/messages"),
  getConversation: (userId) => api.get(`/messages/${userId}`),
  send: (recipientId, text) => api.post("/messages", { recipientId, text }),
};
