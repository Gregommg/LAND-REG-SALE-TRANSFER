const pool = require("../config/db");
const { logAction } = require("../utils/auditLogger");

/**
 * GET /api/transactions
 * Lists transactions. Landowners/buyers see only transactions they are
 * party to; registrars/admins/auditors see everything.
 */
async function getTransactions(req, res, next) {
  const { status } = req.query;
  const { id: userId, role } = req.user;

  try {
    const conditions = [];
    const values = [];

    if (!["admin", "registrar", "auditor"].includes(role)) {
      values.push(userId, userId);
      conditions.push(`(t.seller_id = $${values.length - 1} OR t.buyer_id = $${values.length})`);
    }

    if (status) {
      values.push(status);
      conditions.push(`t.status = $${values.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT t.*, lp.parcel_number, lp.location,
              seller.full_name AS seller_name, seller.phone_number AS seller_phone, seller.email AS seller_email,
              buyer.full_name AS buyer_name, buyer.phone_number AS buyer_phone, buyer.email AS buyer_email
       FROM transactions t
       JOIN land_parcels lp ON lp.id = t.parcel_id
       JOIN users seller ON seller.id = t.seller_id
       JOIN users buyer ON buyer.id = t.buyer_id
       ${whereClause}
       ORDER BY t.initiated_at DESC`,
      values
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/transactions/:id
 */
async function getTransactionById(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT t.*, lp.parcel_number, lp.location,
              seller.full_name AS seller_name, seller.phone_number AS seller_phone, seller.email AS seller_email,
              buyer.full_name AS buyer_name, buyer.phone_number AS buyer_phone, buyer.email AS buyer_email
       FROM transactions t
       JOIN land_parcels lp ON lp.id = t.parcel_id
       JOIN users seller ON seller.id = t.seller_id
       JOIN users buyer ON buyer.id = t.buyer_id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/transactions
 * Initiates a sale or transfer application. Only the registered owner of
 * the parcel (the seller) may initiate it.
 */
/**
 * POST /api/transactions
 * Two ways to start a sale/transfer, both purely ownership-based:
 *  - The current owner (seller) initiates it and names a specific buyer -
 *    this covers private sales and transfers (e.g. gifting to a relative).
 *  - Anyone else can "buy" a parcel that is publicly listed with
 *    status = 'for_sale' - they become the buyer automatically, at the
 *    listed asking price unless they specify a different offer amount.
 */
async function createTransaction(req, res, next) {
  const { parcelId, buyerId, transactionType, amount, notes, paymentMethod } = req.body;
  const client = await pool.connect();

  try {
    if (!parcelId) {
      return res.status(400).json({ message: "parcelId is required" });
    }

    await client.query("BEGIN");

    const parcelResult = await client.query("SELECT * FROM land_parcels WHERE id = $1 FOR UPDATE", [
      parcelId,
    ]);
    const parcel = parcelResult.rows[0];

    if (!parcel) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Land parcel not found" });
    }

    const STAFF_ROLES = ["admin", "registrar", "auditor"];
    const isOwner = parcel.owner_id === req.user.id;
    // Registrar/admin may facilitate a private sale/transfer on the owner's
    // behalf (e.g. processing manual paperwork), naming who the buyer is.
    const isFacilitatingStaff = !isOwner && ["admin", "registrar"].includes(req.user.role);

    let finalBuyerId;
    let finalType = transactionType;

    if (isOwner || isFacilitatingStaff) {
      // Owner-initiated (or staff facilitating on the owner's behalf): a
      // specific buyer must be named, and either a private sale (unlisted)
      // or transfer can be started this way.
      if (!buyerId) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "buyerId is required when initiating on behalf of the owner" });
      }
      if (!["sale", "transfer"].includes(transactionType)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "transactionType must be 'sale' or 'transfer'" });
      }
      if (!["registered", "for_sale"].includes(parcel.status)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: `Parcel is currently '${parcel.status}' and not eligible` });
      }
      finalBuyerId = buyerId;
    } else {
      // Buyer-initiated purchase: only citizens can buy - system/staff
      // accounts (admin, registrar, auditor) never act as a buyer.
      if (STAFF_ROLES.includes(req.user.role)) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          message: "Staff accounts cannot purchase land - only citizen accounts can buy a listed parcel",
        });
      }
      if (parcel.status !== "for_sale") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "This parcel is not currently listed for sale" });
      }
      finalBuyerId = req.user.id;
      finalType = "sale";
    }

    if (Number(finalBuyerId) === Number(parcel.owner_id)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "The buyer and the current owner cannot be the same person" });
    }

    // Whoever ends up as the buyer - even when named by a facilitating
    // registrar/admin - must be an ordinary citizen, never a staff account.
    const buyerCheck = await client.query("SELECT role FROM users WHERE id = $1", [finalBuyerId]);
    if (buyerCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Buyer account not found" });
    }
    if (STAFF_ROLES.includes(buyerCheck.rows[0].role)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Land cannot be sold or transferred to a staff/system account" });
    }

    // A 'sale' must specify how payment will be handled; a 'transfer' (e.g.
    // gifting land to a relative) has no money involved, so no payment
    // method applies.
    let finalPaymentMethod = null;
    if (finalType === "sale") {
      if (!["bank_transfer", "cash"].includes(paymentMethod)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "paymentMethod must be 'bank_transfer' or 'cash' for a sale" });
      }
      finalPaymentMethod = paymentMethod;
    }

    const finalAmount = amount !== undefined && amount !== null ? amount : parcel.asking_price || 0;

    const txResult = await client.query(
      `INSERT INTO transactions (parcel_id, seller_id, buyer_id, transaction_type, amount, payment_method, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [parcelId, parcel.owner_id, finalBuyerId, finalType, finalAmount, finalPaymentMethod, notes || null]
    );

    await client.query("UPDATE land_parcels SET status = 'under_transfer' WHERE id = $1", [parcelId]);

    await client.query("COMMIT");

    await logAction(
      req.user.id,
      "TRANSACTION_CREATE",
      isOwner || isFacilitatingStaff
        ? `Initiated ${finalType} for parcel #${parcelId} with buyer #${finalBuyerId}`
        : `Initiated purchase of parcel #${parcelId} at ${finalAmount}`,
      req.ip
    );

    res.status(201).json(txResult.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

/**
 * PUT /api/transactions/:id/confirm-payment
 * Only the seller can confirm they've actually received the money (by bank
 * transfer or in cash) - the registrar cannot finalize a sale until this
 * happens, since there's no real payment gateway to verify it automatically.
 */
async function confirmPayment(req, res, next) {
  try {
    const txResult = await pool.query("SELECT * FROM transactions WHERE id = $1", [req.params.id]);
    const tx = txResult.rows[0];

    if (!tx) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    if (tx.seller_id !== req.user.id) {
      return res.status(403).json({ message: "Only the seller can confirm receipt of payment" });
    }
    if (tx.transaction_type !== "sale") {
      return res.status(400).json({ message: "Only a sale involves a payment to confirm" });
    }
    if (tx.status !== "pending") {
      return res.status(400).json({ message: `Transaction already ${tx.status}` });
    }
    if (tx.payment_confirmed_by_seller) {
      return res.status(400).json({ message: "Payment has already been confirmed" });
    }

    const result = await pool.query(
      `UPDATE transactions SET payment_confirmed_by_seller = TRUE, payment_confirmed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await logAction(
      req.user.id,
      "PAYMENT_CONFIRM",
      `Seller confirmed receipt of payment for transaction #${req.params.id}`,
      req.ip
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/transactions/:id/approve
 * Registrar/admin approves and completes a transaction, updating parcel
 * ownership atomically.
 */
async function approveTransaction(req, res, next) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const txResult = await client.query("SELECT * FROM transactions WHERE id = $1 FOR UPDATE", [
      req.params.id,
    ]);
    const tx = txResult.rows[0];

    if (!tx) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Transaction not found" });
    }
    if (tx.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: `Transaction already ${tx.status}` });
    }
    // A sale can only be finalized once the seller has confirmed they were
    // actually paid; a transfer has no money involved, so this doesn't apply.
    if (tx.transaction_type === "sale" && !tx.payment_confirmed_by_seller) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "The seller must confirm receipt of payment before this sale can be approved",
      });
    }

    await client.query(
      `UPDATE transactions SET status = 'completed', approved_by = $1, decided_at = NOW(), completed_at = NOW()
       WHERE id = $2`,
      [req.user.id, tx.id]
    );

    await client.query(
      `UPDATE land_parcels SET owner_id = $1, status = 'transferred', asking_price = NULL WHERE id = $2`,
      [tx.buyer_id, tx.parcel_id]
    );

    // Newly transferred land becomes a normal registered parcel again for the new owner
    await client.query(`UPDATE land_parcels SET status = 'registered' WHERE id = $1`, [tx.parcel_id]);

    await client.query("COMMIT");

    await logAction(
      req.user.id,
      "TRANSACTION_APPROVE",
      `Approved transaction #${tx.id}, ownership of parcel #${tx.parcel_id} moved to user #${tx.buyer_id}`,
      req.ip
    );

    res.json({ message: "Transaction approved and ownership updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

/**
 * PUT /api/transactions/:id/reject
 */
async function rejectTransaction(req, res, next) {
  const { reason } = req.body;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const txResult = await client.query("SELECT * FROM transactions WHERE id = $1 FOR UPDATE", [
      req.params.id,
    ]);
    const tx = txResult.rows[0];

    if (!tx) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Transaction not found" });
    }
    if (tx.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: `Transaction already ${tx.status}` });
    }

    await client.query(
      `UPDATE transactions SET status = 'rejected', approved_by = $1, decided_at = NOW(), notes = COALESCE($2, notes)
       WHERE id = $3`,
      [req.user.id, reason, tx.id]
    );

    await client.query(
      `UPDATE land_parcels
       SET status = CASE WHEN asking_price IS NOT NULL THEN 'for_sale' ELSE 'registered' END
       WHERE id = $1`,
      [tx.parcel_id]
    );

    await client.query("COMMIT");

    await logAction(req.user.id, "TRANSACTION_REJECT", `Rejected transaction #${tx.id}`, req.ip);

    res.json({ message: "Transaction rejected" });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  confirmPayment,
  approveTransaction,
  rejectTransaction,
};
