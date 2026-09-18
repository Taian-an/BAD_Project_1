import { useState } from 'react';

export default function CategoriesPanel({ categories, role, onCreate, onDelete }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const canWrite = role === 'STAFF';
  const canDelete = role === 'STAFF';

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onCreate({ name, description: description || undefined });
    setName('');
    setDescription('');
  };

  return (
    <div className="card">
      <h2>Categories</h2>

      {canWrite && (
        <form onSubmit={handleSubmit} className="form-row" style={{ alignItems: 'end' }}>
          <div className="field">
            <label htmlFor="cat-name">Name</label>
            <input id="cat-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cat-desc">Description</label>
            <input id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">
            Add category
          </button>
        </form>
      )}

      {categories.length === 0 ? (
        <p className="empty">No categories yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Description</th>
              {canDelete && <th></th>}
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.name}</td>
                <td>{c.description || '—'}</td>
                {canDelete && (
                  <td>
                    <button className="btn-danger" onClick={() => onDelete(c.id)}>
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
