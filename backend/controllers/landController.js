const path = require("path");
const fs = require("fs");
const pool = require("../config/db");
const { logAction } = require("../utils/auditLogger");
const { TITLE_DEEDS_DIR } = require("../middleware/uploadMiddleware");

/**
 * GET /api/land
 * Search / list land parcels. Supports optional query params:
 * q (parcel number / location / title deed), county, status, ownerId
 */
async function getParcels(req, res, next) {
  const { q, county, status, ownerId } = req.query;
  const { role, id: requesterId } = req.user;
  const isStaff = ["admin", "registrar", "auditor"].includes(role);

  try {
    const conditions = [];
    const values = [];

    if (q) {
      values.push(`%${q}%`);
      conditions.push(
        `(parcel_number ILIKE $${values.length} OR location ILIKE $${values.length} OR title_deed_number ILIKE $${values.length})`
      );
    }
    if (county) {
      values.push(county);
      conditions.push(`county = $${values.length}`);
    }
    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
      // Non-staff users may only see other people's pending/rejected requests if
      // they are the owner of that request; otherwise scope it to their own records.
      if (["pending", "rejected"].includes(status) && !isStaff) {
        values.push(requesterId);
        conditions.push(`owner_id = $${values.length}`);
      }
    } else if (!isStaff) {
      // General browsing (no explicit status filter): hide unapproved/rejected
      // registration requests from other users, but let owners still see their own.
      conditions.push(`(status NOT IN ('pending', 'rejected') OR owner_id = $${values.length + 1})`);
      values.push(requesterId);
    }
    if (ownerId) {
      values.push(ownerId);
      conditions.push(`owner_id = $${values.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT lp.*, u.full_name AS owner_name, u.email AS owner_email
       FROM land_parcels lp
       JOIN users u ON u.id = lp.owner_id
       ${whereClause}
       ORDER BY lp.created_at DESC`,
      values
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/land/:id
 */
async function getParcelById(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT lp.*, u.full_name AS owner_name, u.email AS owner_email
       FROM land_parcels lp
       JOIN users u ON u.id = lp.owner_id
       WHERE lp.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Land parcel not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/land
 * Open to any authenticated user. Registrars/admins register a parcel
 * directly and it becomes active immediately. Everyone else submits a
 * self-registration request for land in their own name, which stays in
 * 'pending' status until a registrar (or admin) reviews and approves it.
 */
async function createParcel(req, res, next) {
  const {
    parcelNumber,
    titleDeedNumber,
    county,
    subCounty,
    location,
    sizeAcres,
    landUse,
    latitude,
    longitude,
    ownerId,
  } = req.body;
  const titleDeedFile = req.files?.titleDeedDocument?.[0];

  try {
    if (!parcelNumber || !county || !location || !sizeAcres) {
      return res.status(400).json({
        message: "parcelNumber, county, location and sizeAcres are required",
      });
    }

    const isRegistrarOrAdmin = ["registrar", "admin"].includes(req.user.role);

    // Citizens registering their own land must attach proof of ownership
    // (a scanned copy of their title deed) for the registrar to verify.
    // Registrars/admins encoding records directly may not always have a
    // scan on hand, so it stays optional for them.
    if (!isRegistrarOrAdmin && !titleDeedFile) {
      return res.status(400).json({ message: "A PDF copy of the title deed is required" });
    }

    // Registrars/admins may register on behalf of a given owner and it is
    // immediately active. Everyone else is registering their own land and
    // it must go through the approval queue.
    const finalOwnerId = isRegistrarOrAdmin ? ownerId || req.user.id : req.user.id;
    const status = isRegistrarOrAdmin ? "registered" : "pending";
    const registeredBy = isRegistrarOrAdmin ? req.user.id : null;
    const titleDeedDocumentPath = titleDeedFile ? `title-deeds/${titleDeedFile.filename}` : null;

    const result = await pool.query(
      `INSERT INTO land_parcels
        (parcel_number, title_deed_number, county, sub_county, location, size_acres, land_use, latitude, longitude, owner_id, status, registered_by, title_deed_document_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        parcelNumber,
        titleDeedNumber || null,
        county,
        subCounty || null,
        location,
        sizeAcres,
        landUse || "residential",
        latitude || null,
        longitude || null,
        finalOwnerId,
        status,
        registeredBy,
        titleDeedDocumentPath,
      ]
    );

    await logAction(
      req.user.id,
      "PARCEL_CREATE",
      isRegistrarOrAdmin
        ? `Registered parcel ${parcelNumber} for owner #${finalOwnerId}`
        : `Submitted land registration request for parcel ${parcelNumber}, pending registrar approval`,
      req.ip
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/land/:id/approve
 * Registrar/admin approves a pending self-registration request, making the
 * parcel an active registered record.
 */
async function approveParcel(req, res, next) {
  try {
    const result = await pool.query(
      `UPDATE land_parcels SET status = 'registered', registered_by = $1
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [req.user.id, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Pending land registration request not found" });
    }

    await logAction(
      req.user.id,
      "PARCEL_APPROVE",
      `Approved land registration request for parcel #${req.params.id}`,
      req.ip
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/land/:id/reject
 * Registrar/admin rejects a pending self-registration request.
 */
async function rejectParcel(req, res, next) {
  const { reason } = req.body;

  try {
    const result = await pool.query(
      `UPDATE land_parcels SET status = 'rejected'
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Pending land registration request not found" });
    }

    await logAction(
      req.user.id,
      "PARCEL_REJECT",
      `Rejected land registration request for parcel #${req.params.id}${reason ? `: ${reason}` : ""}`,
      req.ip
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/land/:id
 * Updates a land parcel's details. Restricted to registrar/admin.
 */
async function updateParcel(req, res, next) {
  const { id } = req.params;
  const {
    location,
    sizeAcres,
    landUse,
    latitude,
    longitude,
    status,
    titleDeedNumber,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE land_parcels SET
         location = COALESCE($1, location),
         size_acres = COALESCE($2, size_acres),
         land_use = COALESCE($3, land_use),
         latitude = COALESCE($4, latitude),
         longitude = COALESCE($5, longitude),
         status = COALESCE($6, status),
         title_deed_number = COALESCE($7, title_deed_number)
       WHERE id = $8
       RETURNING *`,
      [location, sizeAcres, landUse, latitude, longitude, status, titleDeedNumber, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Land parcel not found" });
    }

    await logAction(req.user.id, "PARCEL_UPDATE", `Updated parcel #${id}`, req.ip);

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/land/:id/list
 * The owner (or staff) lists a registered parcel publicly for sale with an
 * asking price. Ownership determines who can do this, not account role.
 */
async function listForSale(req, res, next) {
  const { askingPrice } = req.body;

  try {
    if (askingPrice === undefined || askingPrice === null || Number(askingPrice) <= 0) {
      return res.status(400).json({ message: "A valid askingPrice greater than 0 is required" });
    }

    const parcelResult = await pool.query("SELECT * FROM land_parcels WHERE id = $1", [req.params.id]);
    const parcel = parcelResult.rows[0];

    if (!parcel) {
      return res.status(404).json({ message: "Land parcel not found" });
    }
    if (parcel.owner_id !== req.user.id && !["admin", "registrar"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only the registered owner can list this parcel for sale" });
    }
    if (parcel.status !== "registered") {
      return res.status(400).json({ message: `Parcel must be 'registered' to be listed (currently '${parcel.status}')` });
    }

    const result = await pool.query(
      `UPDATE land_parcels SET status = 'for_sale', asking_price = $1 WHERE id = $2 RETURNING *`,
      [askingPrice, req.params.id]
    );

    await logAction(
      req.user.id,
      "PARCEL_LIST_FOR_SALE",
      `Listed parcel #${req.params.id} for sale at ${askingPrice}`,
      req.ip
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/land/:id/unlist
 * The owner (or staff) withdraws a parcel from public sale.
 */
async function unlistParcel(req, res, next) {
  try {
    const parcelResult = await pool.query("SELECT * FROM land_parcels WHERE id = $1", [req.params.id]);
    const parcel = parcelResult.rows[0];

    if (!parcel) {
      return res.status(404).json({ message: "Land parcel not found" });
    }
    if (parcel.owner_id !== req.user.id && !["admin", "registrar"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only the registered owner can unlist this parcel" });
    }
    if (parcel.status !== "for_sale") {
      return res.status(400).json({ message: "Parcel is not currently listed for sale" });
    }

    const result = await pool.query(
      `UPDATE land_parcels SET status = 'registered', asking_price = NULL WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await logAction(req.user.id, "PARCEL_UNLIST", `Unlisted parcel #${req.params.id} from sale`, req.ip);

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/land/:id/history
 * Returns the full ownership/transaction history for a parcel - every sale
 * or transfer application ever raised against it, most recent first.
 */
async function getParcelHistory(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT t.id, t.transaction_type, t.amount, t.status, t.notes,
              t.initiated_at, t.decided_at, t.completed_at,
              seller.full_name AS seller_name, buyer.full_name AS buyer_name,
              approver.full_name AS approved_by_name
       FROM transactions t
       JOIN users seller ON seller.id = t.seller_id
       JOIN users buyer ON buyer.id = t.buyer_id
       LEFT JOIN users approver ON approver.id = t.approved_by
       WHERE t.parcel_id = $1
       ORDER BY t.initiated_at DESC`,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/land/:id/title-deed-document
 * Streams the PDF the applicant uploaded as proof of ownership when
 * submitting their registration request. Only the parcel's owner or staff
 * (registrar/admin) may view it - it is never served statically.
 */
async function getTitleDeedDocument(req, res, next) {
  try {
    const result = await pool.query(
      "SELECT owner_id, title_deed_document_path FROM land_parcels WHERE id = $1",
      [req.params.id]
    );
    const parcel = result.rows[0];

    if (!parcel) {
      return res.status(404).json({ message: "Land parcel not found" });
    }
    if (parcel.owner_id !== req.user.id && !["admin", "registrar"].includes(req.user.role)) {
      return res.status(403).json({ message: "You are not authorized to view this document" });
    }
    if (!parcel.title_deed_document_path) {
      return res.status(404).json({ message: "No title deed document was uploaded for this parcel" });
    }

    const filename = path.basename(parcel.title_deed_document_path);
    const fullPath = path.join(TITLE_DEEDS_DIR, filename);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: "Document file could not be found on the server" });
    }

    await logAction(req.user.id, "TITLE_DEED_DOCUMENT_VIEW", `Viewed title deed document for parcel #${req.params.id}`, req.ip);

    res.sendFile(fullPath);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/land/:id
 * Restricted to admin only.
 */
async function deleteParcel(req, res, next) {
  try {
    const result = await pool.query("DELETE FROM land_parcels WHERE id = $1 RETURNING id", [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Land parcel not found" });
    }

    await logAction(req.user.id, "PARCEL_DELETE", `Deleted parcel #${req.params.id}`, req.ip);

    res.json({ message: "Land parcel deleted successfully" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getParcels,
  getParcelById,
  createParcel,
  updateParcel,
  deleteParcel,
  approveParcel,
  rejectParcel,
  listForSale,
  unlistParcel,
  getParcelHistory,
  getTitleDeedDocument,
};
