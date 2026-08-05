function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/**
 * Profit & loss for a date window.
 * Revenue = completed sales grand_total.
 * COGS ≈ sale lines × product.cost (fallback 0).
 * Expenses = expenses.amount in range.
 */
export async function computeProfitLoss(pool, { from = null, to = null } = {}) {
  const saleParams = [];
  let saleWhere = `s.sale_status = 'completed'`;
  if (from) {
    saleWhere += ' AND DATE(s.sale_date) >= ?';
    saleParams.push(from);
  }
  if (to) {
    saleWhere += ' AND DATE(s.sale_date) <= ?';
    saleParams.push(to);
  }

  const [[rev]] = await pool.query(
    `SELECT COALESCE(SUM(s.grand_total), 0) AS revenue, COUNT(*) AS sale_count
     FROM sales s WHERE ${saleWhere}`,
    saleParams
  );

  const [[cogsRow]] = await pool.query(
    `SELECT COALESCE(SUM(ps.qty * COALESCE(p.cost, 0)), 0) AS cogs
     FROM product_sales ps
     INNER JOIN sales s ON s.id = ps.sale_id
     LEFT JOIN products p ON p.id = ps.product_id
     WHERE ${saleWhere}`,
    saleParams
  );

  const expParams = [];
  let expWhere = '1=1';
  if (from) {
    expWhere += ' AND e.expense_date >= ?';
    expParams.push(from);
  }
  if (to) {
    expWhere += ' AND e.expense_date <= ?';
    expParams.push(to);
  }
  const [[exp]] = await pool.query(
    `SELECT COALESCE(SUM(e.amount), 0) AS total FROM expenses e WHERE ${expWhere}`,
    expParams
  );

  const revenue = num(rev.revenue);
  const cogs = num(cogsRow.cogs);
  const expenses = num(exp.total);
  const gross_profit = revenue - cogs;
  const net_profit = gross_profit - expenses;

  return {
    from: from || null,
    to: to || null,
    revenue,
    cogs,
    gross_profit,
    expenses,
    net_profit,
    sale_count: Number(rev.sale_count) || 0,
  };
}

export async function computeBalanceSheet(pool) {
  const [[accounts]] = await pool.query(
    `SELECT COALESCE(SUM(balance),0) AS total FROM erp_accounts WHERE is_active = 1`
  );
  const [[sales]] = await pool.query(
    `SELECT COALESCE(SUM(grand_total),0) AS total, COALESCE(SUM(paid_amount),0) AS paid FROM sales`
  );
  const [[purchases]] = await pool.query(
    `SELECT COALESCE(SUM(grand_total),0) AS total, COALESCE(SUM(paid_amount),0) AS paid FROM purchases`
  );
  const [[expenses]] = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total FROM expenses`
  );
  const [[recv]] = await pool.query(
    `SELECT COALESCE(SUM(GREATEST(grand_total - paid_amount, 0)), 0) AS total
     FROM sales WHERE payment_status IN ('pending','partial')`
  );
  const [[pay]] = await pool.query(
    `SELECT COALESCE(SUM(GREATEST(grand_total - paid_amount, 0)), 0) AS total
     FROM purchases WHERE payment_status IN ('pending','partial')`
  );
  const [accountRows] = await pool.query(
    `SELECT id, name, account_no, balance FROM erp_accounts WHERE is_active = 1 ORDER BY name`
  );

  const accounts_total = num(accounts.total);
  const sales_total = num(sales.total);
  const sales_paid = num(sales.paid);
  const purchases_total = num(purchases.total);
  const purchases_paid = num(purchases.paid);
  const expenses_total = num(expenses.total);
  const receivables = num(recv.total);
  const payables = num(pay.total);
  const cash_accounts_sum = accounts_total;

  return {
    accounts_total,
    cash_accounts_sum,
    receivables,
    payables,
    sales_total,
    sales_paid,
    purchases_total,
    purchases_paid,
    expenses_total,
    accounts: accountRows,
  };
}
