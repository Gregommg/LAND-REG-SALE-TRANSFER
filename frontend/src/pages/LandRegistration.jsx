import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { landService } from "../api/services";
import Layout from "../components/Layout";
import Alert from "../components/Alert";
import "../styles/Forms.css";

const initialForm = {
  parcelNumber: "",
  titleDeedNumber: "",
  county: "",
  subCounty: "",
  location: "",
  sizeAcres: "",
  landUse: "residential",
  latitude: "",
  longitude: "",
  ownerId: "",
};

export default function LandRegistration() {
  const { user } = useAuth();
  const canRegisterDirectly = ["registrar", "admin"].includes(user.role);

  const [form, setForm] = useState(initialForm);
  const [titleDeedDocument, setTitleDeedDocument] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);

    if (!canRegisterDirectly && !titleDeedDocument) {
      setMessage({ type: "error", text: "Please upload a PDF copy of your title deed as proof of ownership." });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("parcelNumber", form.parcelNumber);
      formData.append("titleDeedNumber", form.titleDeedNumber);
      formData.append("county", form.county);
      formData.append("subCounty", form.subCounty);
      formData.append("location", form.location);
      formData.append("sizeAcres", Number(form.sizeAcres));
      formData.append("landUse", form.landUse);
      if (form.latitude) formData.append("latitude", Number(form.latitude));
      if (form.longitude) formData.append("longitude", Number(form.longitude));
      if (canRegisterDirectly && form.ownerId) {
        formData.append("ownerId", Number(form.ownerId));
      }
      if (titleDeedDocument) {
        formData.append("titleDeedDocument", titleDeedDocument);
      }

      await landService.create(formData);

      setMessage({
        type: "success",
        text: canRegisterDirectly
          ? "Land parcel registered successfully."
          : "Your land registration request has been submitted and is pending review by a registrar.",
      });
      setForm(initialForm);
      setTitleDeedDocument(null);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to submit land registration." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <h2>{canRegisterDirectly ? "Register Land Parcel" : "Request Land Registration"}</h2>
        <p>
          {canRegisterDirectly
            ? "Create a new land ownership record directly in the centralized digital database."
            : "Submit your land details for registration. A registrar will review and approve your request before it becomes an official record."}
        </p>
      </div>

      <Alert type={message?.type} message={message?.text} onClose={() => setMessage(null)} />

      <form onSubmit={handleSubmit} className="form-card form-grid">
        <div>
          <label htmlFor="parcelNumber">Parcel Number</label>
          <input id="parcelNumber" name="parcelNumber" value={form.parcelNumber} onChange={handleChange} placeholder="e.g. NRB/BLK1/002" required />
        </div>

        <div>
          <label htmlFor="titleDeedNumber">Title Deed Number</label>
          <input id="titleDeedNumber" name="titleDeedNumber" value={form.titleDeedNumber} onChange={handleChange} placeholder="e.g. TD-2026-002" />
        </div>

        <div>
          <label htmlFor="county">County</label>
          <input id="county" name="county" value={form.county} onChange={handleChange} placeholder="e.g. Nairobi" required />
        </div>

        <div>
          <label htmlFor="subCounty">Sub-County</label>
          <input id="subCounty" name="subCounty" value={form.subCounty} onChange={handleChange} placeholder="e.g. Westlands" />
        </div>

        <div className="form-full">
          <label htmlFor="location">Location / Description</label>
          <input id="location" name="location" value={form.location} onChange={handleChange} placeholder="e.g. Off Waiyaki Way, Westlands" required />
        </div>

        <div>
          <label htmlFor="sizeAcres">Size (acres)</label>
          <input id="sizeAcres" name="sizeAcres" type="number" step="0.01" min="0.01" value={form.sizeAcres} onChange={handleChange} required />
        </div>

        <div>
          <label htmlFor="landUse">Land Use</label>
          <select id="landUse" name="landUse" value={form.landUse} onChange={handleChange}>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="agricultural">Agricultural</option>
            <option value="industrial">Industrial</option>
          </select>
        </div>

        <div>
          <label htmlFor="latitude">Latitude</label>
          <input id="latitude" name="latitude" type="number" step="0.000001" value={form.latitude} onChange={handleChange} placeholder="e.g. -1.265700" />
        </div>

        <div>
          <label htmlFor="longitude">Longitude</label>
          <input id="longitude" name="longitude" type="number" step="0.000001" value={form.longitude} onChange={handleChange} placeholder="e.g. 36.812100" />
        </div>

        {canRegisterDirectly && (
          <div>
            <label htmlFor="ownerId">Owner User ID</label>
            <input
              id="ownerId"
              name="ownerId"
              type="number"
              value={form.ownerId}
              onChange={handleChange}
              placeholder="Leave blank to register to yourself"
            />
          </div>
        )}

        <div className="form-full">
          <label htmlFor="titleDeedDocument">
            Title Deed (PDF){!canRegisterDirectly && " - required"}
          </label>
          <input
            id="titleDeedDocument"
            type="file"
            accept="application/pdf"
            onChange={(e) => setTitleDeedDocument(e.target.files?.[0] || null)}
            required={!canRegisterDirectly}
          />
          <p className="field-hint">
            {canRegisterDirectly
              ? "Optional when encoding an existing record directly."
              : "A scanned PDF of your title deed is required as proof of ownership before a registrar can approve this request."}
          </p>
        </div>

        <button className="btn btn-primary form-full" type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : canRegisterDirectly ? "Register Land Parcel" : "Submit Registration Request"}
        </button>
      </form>
    </Layout>
  );
}
