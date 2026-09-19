import { useState } from 'react';

// STUDENT places an order for themselves — no discount code to type. The
// backend automatically checks whether the chosen product is tagged with a
// discountDepartment matching the buyer's own AD department claim, and only
// then calls the peer enrollment API to verify it (proposal §9.2's "CS
// jacket" scenario). STAFF instead sees every order placed, not a shopping
// form (backend gates GET /api/orders to STAFF).
export default function OrdersPanel({ role, products, orders, onPlaceOrder }) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [lastResult, setLastResult] = useState(null);

  const isStudent = role === 'STUDENT';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLastResult(null);
    const order = await onPlaceOrder({
      items: [{ productId, quantity: parseInt(quantity, 10) }],
    });
    if (order) setLastResult(order);
  };

  return (
    <div className="card">
      <h2>{isStudent ? 'Place an order' : 'Orders'}</h2>

      {isStudent && (
        <form onSubmit={handleSubmit} className="form-row" style={{ alignItems: 'end' }}>
          <div className="field">
            <label htmlFor="o-product">Product</label>
            <select id="o-product" required value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="" disabled>
                Select…
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ${Number(p.basePrice).toFixed(2)}
                  {p.discountDepartment ? ` (${p.discountDepartment} discount)` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="o-qty">Quantity</label>
            <input
              id="o-qty"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={!products.length}>
            Place order
          </button>
        </form>
      )}

      {isStudent && (
        <p className="hint">
          No code needed — a discount is applied automatically when the product's tagged
          department matches your own department, verified against the enrollment API.
        </p>
      )}

      {lastResult && (
        <p className="hint">
          Order #{lastResult.id} — total ${Number(lastResult.totalAmount).toFixed(2)}
          {lastResult.discountApplied ? ' (10% department discount applied)' : ' (no discount applied)'}
        </p>
      )}

      {orders.length === 0 ? (
        <p className="empty">No orders yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              {!isStudent && <th>Student</th>}
              <th>Total</th>
              <th>Discount</th>
              <th>Placed</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                {!isStudent && <td>{o.user?.email || '—'}</td>}
                <td>${Number(o.totalAmount).toFixed(2)}</td>
                <td>{o.discountApplied ? 'Yes' : 'No'}</td>
                <td>{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
