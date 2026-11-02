import { randomUUID } from 'node:crypto';
import { getPool } from '../db/pool.js';
import { nextErpReference } from './erp/referenceNumbers.js';
import {
  collect,
  collectionPaid,
  extractAmount,
  extractDepositId,
  extractFailure,
  extractStatus,
  getDeposit,
  isAcceptedStatus,
  isFailureStatus,
  isSuccessStatus,
  momoNumber,
  payingMethodLabel,
  pawapayConfigured,
  predictProvider,
  providerForPhone,
} from './pawapayClient.js';

export async function startDeposit({
  purpose,
  purposeId,
  amount,
  phone,
  description,
  networkHint,
  userId,
}) {
  if (!pawapayConfigured()) {
    return { ok: false, message: 'PawaPay is not configured. Add PAWAPAY_API_TOKEN on the Alpha API server.' };
  }
  const msisdn = momoNumber(phone);
  if (!msisdn || msisdn.length < 10) {
    return { ok: false, message: 'Enter a valid Rwanda MoMo number (078… or 079…).' };
  }
  const intAmount = Math.round(Number(amount));
  if (intAmount < 100) {
    return { ok: false, message: 'MoMo amount must be at least 100 RWF.' };
  }

  const pool = getPool();
  const [reuse] = await pool.query(
    `SELECT * FROM pawapay_deposits
     WHERE purpose = ? AND purpose_id = ? AND status = 'pending' AND phone = ? AND amount = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
     ORDER BY created_at DESC LIMIT 1`,
    [purpose, String(purposeId), msisdn, intAmount]
  );
  if (reuse[0]) return { ok: true, deposit: reuse[0], reused: true };

  const predicted = await predictProvider(msisdn);
  const provider = predicted || providerForPhone(msisdn, networkHint);
  const depositId = randomUUID();
  const response = await collect({
    amount: intAmount,
    phone: msisdn,
    description,
    depositId,
    networkHint,
  });
  const status = extractStatus(response);
  if (response?.stub || isFailureStatus(status) || (!isAcceptedStatus(status) && !isSuccessStatus(status))) {
    return {
      ok: false,
      message: extractFailure(response) || 'Could not start Mobile Money. Check the number and try again.',
      raw: response,
    };
  }

  const id = randomUUID();
  await pool.query(
    `INSERT INTO pawapay_deposits
      (id, deposit_id, purpose, purpose_id, amount, currency, phone, provider, paying_method, status, raw_status, user_id)
     VALUES (?, ?, ?, ?, ?, 'RWF', ?, ?, ?, 'pending', ?, ?)`,
    [id, depositId, purpose, String(purposeId), intAmount, msisdn, provider, payingMethodLabel(provider), status, userId || null]
  );

  const [rows] = await pool.query('SELECT * FROM pawapay_deposits WHERE id = ? LIMIT 1', [id]);
  const row = rows[0];
  if (isSuccessStatus(status) && collectionPaid(response, intAmount)) {
    await syncStatus(row, status, response);
    const [fresh] = await pool.query('SELECT * FROM pawapay_deposits WHERE id = ? LIMIT 1', [id]);
    return { ok: true, deposit: fresh[0], immediate: true };
  }
  return { ok: true, deposit: row };
}

export async function refreshAndApply(depositId) {
  const pool = getPool();
  const [rows] = await pool.query('SELECT * FROM pawapay_deposits WHERE deposit_id = ? LIMIT 1', [depositId]);
  const row = rows[0];
  if (!row) return null;
  if (row.applied_at) return row;
  const remote = await getDeposit(depositId);
  await syncStatus(row, extractStatus(remote), remote);
  const [fresh] = await pool.query('SELECT * FROM pawapay_deposits WHERE deposit_id = ? LIMIT 1', [depositId]);
  return fresh[0] || null;
}

export async function handleCallback(payload) {
  const depositId = extractDepositId(payload);
  if (!depositId) {
    console.warn('PawaPay callback missing depositId');
    return null;
  }
  const pool = getPool();
  const [rows] = await pool.query('SELECT * FROM pawapay_deposits WHERE deposit_id = ? LIMIT 1', [depositId]);
  const row = rows[0];
  if (!row) {
    console.warn('PawaPay callback for unknown deposit', depositId);
    return null;
  }
  if (row.applied_at) return row;

  const callbackStatus = extractStatus(payload);
  const remote = await getDeposit(depositId);
  const remoteStatus = extractStatus(remote);
  if (isSuccessStatus(callbackStatus) && !isSuccessStatus(remoteStatus)) {
    console.warn('PawaPay callback said paid but GET did not confirm', depositId);
    await syncStatus(row, remoteStatus || 'PENDING', remote);
    const [fresh] = await pool.query('SELECT * FROM pawapay_deposits WHERE deposit_id = ? LIMIT 1', [depositId]);
    return fresh[0] || null;
  }
  await syncStatus(row, remoteStatus || callbackStatus, remote || payload);
  const [fresh] = await pool.query('SELECT * FROM pawapay_deposits WHERE deposit_id = ? LIMIT 1', [depositId]);
  return fresh[0] || null;
}

async function syncStatus(row, status, remote) {
  if (row.applied_at) return;
  const pool = getPool();
  if (isSuccessStatus(status)) {
    const deposited = extractAmount(remote);
    if (deposited != null && deposited < 1) {
      await pool.query(
        "UPDATE pawapay_deposits SET raw_status = ?, status = 'pending' WHERE id = ?",
        [status, row.id]
      );
      return;
    }
    await pool.query(
      "UPDATE pawapay_deposits SET raw_status = ?, status = 'completed' WHERE id = ?",
      [status, row.id]
    );
    row.status = 'completed';
    await apply(row);
    return;
  }
  if (isFailureStatus(status)) {
    await pool.query(
      "UPDATE pawapay_deposits SET raw_status = ?, status = 'failed' WHERE id = ?",
      [status, row.id]
    );
    return;
  }
  await pool.query(
    "UPDATE pawapay_deposits SET raw_status = ?, status = 'pending' WHERE id = ?",
    [status, row.id]
  );
}

async function apply(row) {
  if (row.applied_at || row.status !== 'completed') return;
  const pool = getPool();
  try {
    if (row.purpose === 'sale') await applySale(row);
    if (row.purpose === 'deposit') await applyDeposit(row);
    await pool.query('UPDATE pawapay_deposits SET applied_at = NOW() WHERE id = ? AND applied_at IS NULL', [row.id]);
  } catch (err) {
    console.error('PawaPay apply failed', row.deposit_id, err.message);
  }
}

async function applySale(row) {
  const pool = getPool();
  const [sales] = await pool.query('SELECT * FROM sales WHERE id = ? LIMIT 1', [row.purpose_id]);
  const sale = sales[0];
  if (!sale) return;
  const [already] = await pool.query(
    "SELECT id FROM erp_payments WHERE payable_type = 'sale' AND payable_id = ? AND note LIKE ? LIMIT 1",
    [sale.id, `%${row.deposit_id}%`]
  );
  if (already.length) return;

  const due = Math.max(0, Number(sale.grand_total || 0) - Number(sale.paid_amount || 0));
  const amount = Math.min(Number(row.amount), due);
  if (amount <= 0) return;

  const paid = Number(sale.paid_amount || 0) + amount;
  const paymentStatus = paid >= Number(sale.grand_total || 0) ? 'paid' : paid > 0 ? 'partial' : 'pending';
  await pool.query(
    `UPDATE sales
     SET paid_amount = ?, payment_status = ?, campay_reference = ?, pawapay_deposit_id = ?
     WHERE id = ?`,
    [paid, paymentStatus, row.deposit_id, row.deposit_id, sale.id]
  );
  await pool.query(
    `INSERT INTO erp_payments (id, reference, payable_type, payable_id, amount, paying_method, note, created_by)
     VALUES (?, ?, 'sale', ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      await nextErpReference('pay-', 'erp_payments'),
      sale.id,
      amount,
      row.paying_method || 'MTN MoMo',
      `PawaPay ${row.deposit_id}`,
      row.user_id || null,
    ]
  );
}

async function applyDeposit(row) {
  const pool = getPool();
  await pool.query(
    `UPDATE deposits
     SET status = 1, amount_received = ?, campay_reference = ?, pawapay_deposit_id = ?
     WHERE id = ?`,
    [row.amount, row.deposit_id, row.deposit_id, row.purpose_id]
  );
}
