import { useState } from 'react';

const emptyForm = {
  name: '',
  basePrice: '',
  stockQty: '',
  categoryId: '',
  description: '',
  discountDepartment: '',
};

export default function ProductsPanel({ products, categories, role, onCreate, onDelete }) {
  const [form, setForm] = useState(emptyForm);
  const canWrite = role === 'STAFF';
  const canDelete = role === 'STAFF';

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onCreate({
      name: form.name,
      basePrice: parseFloat(form.basePrice),
      stockQty: form.stockQty ? parseInt(form.stockQty, 10) : 0,
      categoryId: form.categoryId,
      description: form.description || undefined,
      discountDepartment: form.discountDepartment || undefined,
    });
    setForm(emptyForm);
  };

  return (
    <div className="card">
      <h2>Products</h2>

      {canWrite && (
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="field">
              <label htmlFor="p-name">Name</label>
              <input id="p-name" required value={form.name} onChange={update('name')} />
            </div>
            <div className="field">
              <label htmlFor="p-price">Base price</label>
              <input
                id="p-price"
                type="number"
                step="0.01"
                required
                value={form.basePrice}
                onChange={update('basePrice')}
              />
            </div>
            <div className="field">
              <label htmlFor="p-stock">Stock qty</label>
              <input id="p-stock" type="number" value={form.stockQty} onChange={update('stockQty')} />
            </div>
            <div className="field">
              <label htmlFor="p-category">Category</label>
              <select id="p-category" required value={form.categoryId} onChange={update('categoryId')}>
                <option value="" disabled>
                  Select…
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="p-desc">Staff notes (used to generate the AI description)</label>
            <textarea id="p-desc" rows={2} value={form.description} onChange={update('description')} />
          </div>
          <div className="field">
            <label htmlFor="p-discount-dept">Discount department (optional)</label>
            <input
              id="p-discount-dept"
              value={form.discountDepartment}
              onChange={update('discountDepartment')}
              placeholder="e.g. Computer Science — students from this department get 10% off"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={!categories.length}>
            Add product
          </button>
          {!categories.length && <p className="hint">Add a category first.</p>}
        </form>
      )}

      {products.length === 0 ? (
        <p className="empty">No products yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>AI description</th>
              <th>Discount dept.</th>
              {canDelete && <th></th>}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.name}</td>
                <td>{p.category?.name || '—'}</td>
                <td>${Number(p.basePrice).toFixed(2)}</td>
                <td>{p.stockQty}</td>
                <td className="ai-desc">{p.aiDescription || '—'}</td>
                <td>{p.discountDepartment || '—'}</td>
                {canDelete && (
                  <td>
                    <button className="btn-danger" onClick={() => onDelete(p.id)}>
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
