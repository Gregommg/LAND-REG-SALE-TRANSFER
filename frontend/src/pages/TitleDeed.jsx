import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { landService } from "../api/services";
import Layout from "../components/Layout";
import Alert from "../components/Alert";
import "../styles/TitleDeed.css";

export default function TitleDeed() {
  const { id } = useParams();
  const { user } = useAuth();
  const isStaff = ["admin", "registrar", "auditor"].includes(user.role);

  const [parcel, setParcel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { data } = await landService.getById(id);
        setParcel(data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load this land parcel.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <p className="muted">Loading title deed...</p>
      </Layout>
    );
  }

  if (error || !parcel) {
    return (
      <Layout>
        <Alert type="error" message={error || "Land parcel not found."} />
        <Link className="btn btn-outline" to="/land-search">Back to Search</Link>
      </Layout>
    );
  }

  const isOwner = parcel.owner_id === user.id;
  if (!isOwner && !isStaff) {
    return (
      <Layout>
        <Alert type="error" message="You are not authorized to view this title deed." />
        <Link className="btn btn-outline" to="/land-search">Back to Search</Link>
      </Layout>
    );
  }

  if (parcel.status !== "registered") {
    return (
      <Layout>
        <Alert
          type="info"
          message={`A title deed can only be printed for a fully registered parcel. This parcel is currently '${parcel.status}'.`}
        />
        <Link className="btn btn-outline" to="/land-search">Back to Search</Link>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="title-deed-toolbar no-print">
        <Link className="btn btn-outline" to="/land-search">Back to Search</Link>
        <button className="btn btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <div className="title-deed-certificate">
        <div className="deed-header">
          <span className="deed-emblem">⚑</span>
          <div>
            <h2>Republic of Kenya</h2>
            <p>Ministry of Lands and Physical Planning</p>
          </div>
        </div>

        <h1 className="deed-title">Certificate of Title</h1>

        <table className="deed-table">
          <tbody>
            <tr><th>Parcel Number</th><td>{parcel.parcel_number}</td></tr>
            <tr><th>Title Deed Number</th><td>{parcel.title_deed_number || "Not yet issued"}</td></tr>
            <tr><th>Registered Owner</th><td>{parcel.owner_name}</td></tr>
            <tr><th>County</th><td>{parcel.county}</td></tr>
            <tr><th>Sub-County</th><td>{parcel.sub_county || "—"}</td></tr>
            <tr><th>Location</th><td>{parcel.location}</td></tr>
            <tr><th>Size</th><td>{parcel.size_acres} acres</td></tr>
            <tr><th>Land Use</th><td className="capitalize">{parcel.land_use}</td></tr>
            <tr>
              <th>Geo-Location</th>
              <td>{parcel.latitude && parcel.longitude ? `${parcel.latitude}, ${parcel.longitude}` : "Not recorded"}</td>
            </tr>
            <tr><th>Registration Date</th><td>{new Date(parcel.registration_date).toLocaleDateString()}</td></tr>
          </tbody>
        </table>

        <p className="deed-statement">
          This certifies that the above-named person is the registered proprietor of the parcel of
          land described herein, subject to such encumbrances, easements, and restrictions as may be
          noted in the land register, in accordance with the Land Registration Act.
        </p>

        <div className="deed-signatures">
          <div>
            <div className="deed-signature-line" />
            <p>Land Registrar</p>
          </div>
          <div>
            <div className="deed-signature-line" />
            <p>Date Issued: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
