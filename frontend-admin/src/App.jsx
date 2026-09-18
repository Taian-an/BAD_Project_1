import { useEffect, useState, useCallback } from 'react';
import { API_BASE, request } from './api';
import LoginCard from './components/LoginCard';
import CategoriesPanel from './components/CategoriesPanel';
import ProductsPanel from './components/ProductsPanel';
import OrdersPanel from './components/OrdersPanel';

const STORAGE_KEY = 'campus-store-auth';

function loadAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

// The JWT's payload is base64url, not base64 — the API never re-verifies it
// client-side, this is purely to read the claims already issued to us.
function decodeJwtPayload(token) {
  const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(payload));
}

// After the Azure AD redirect flow, /auth/callback sends the browser back
// here with #token=... (never a query string, so it's never sent to a
// server or logged). Pull it out once and scrub it from the URL.
function consumeAuthFragment() {
  const hash = window.location.hash;
  if (!hash.startsWith('#token=') && !hash.startsWith('#error=')) return null;

  const params = new URLSearchParams(hash.slice(1));
  window.history.replaceState(null, '', window.location.pathname);

  const token = params.get('token');
  if (!token) return { error: params.get('error') || 'Azure AD login failed' };

  const claims = decodeJwtPayload(token);
  return {
    auth: {
      token,
      user: { id: claims.sub, email: claims.email, role: claims.role, department: claims.department },
    },
  };
}

export default function App() {
  const fragment = useState(consumeAuthFragment)[0];
  const [auth, setAuth] = useState(() => fragment?.auth || loadAuth());
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(fragment?.error || '');

  const token = auth?.token;
  const role = auth?.user?.role;

  useEffect(() => {
    if (fragment?.auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(fragment.auth));
  }, [fragment]);

  const refreshCategories = useCallback(async () => {
    const { data } = await request('/api/categories');
    setCategories(data);
  }, []);

  const refreshProducts = useCallback(async () => {
    const { data } = await request('/api/products');
    setProducts(data);
  }, []);

  // STUDENT only ever sees their own orders; STAFF/ADMIN see every order
  // (matches the GET /api/orders vs /api/orders/mine split in orders.js).
  const refreshOrders = useCallback(async () => {
    if (!token) return;
    const path = role === 'STUDENT' ? '/api/orders/mine' : '/api/orders';
    const { data } = await request(path, { token });
    setOrders(data);
  }, [token, role]);

  useEffect(() => {
    refreshCategories().catch((err) => setError(err.message));
    refreshProducts().catch((err) => setError(err.message));
  }, [refreshCategories, refreshProducts]);

  useEffect(() => {
    if (token) refreshOrders().catch((err) => setError(err.message));
  }, [token, refreshOrders]);

  const runOrReportError = async (action) => {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAzureLogin = () => {
    window.location.href = `${API_BASE}/auth/login`;
  };

  const handleLogout = () => {
    setAuth(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleCreateCategory = (body) =>
    runOrReportError(async () => {
      await request('/api/categories', { method: 'POST', token, body });
      await refreshCategories();
    });

  const handleDeleteCategory = (id) =>
    runOrReportError(async () => {
      await request(`/api/categories/${id}`, { method: 'DELETE', token });
      await refreshCategories();
    });

  const handleCreateProduct = (body) =>
    runOrReportError(async () => {
      await request('/api/products', { method: 'POST', token, body });
      await refreshProducts();
    });

  const handleDeleteProduct = (id) =>
    runOrReportError(async () => {
      await request(`/api/products/${id}`, { method: 'DELETE', token });
      await refreshProducts();
    });

  // Returns the created order (so OrdersPanel can show the discount result)
  // instead of just swallowing it like the CRUD handlers above.
  const handlePlaceOrder = async (body) => {
    setError('');
    try {
      const { data } = await request('/api/orders', { method: 'POST', token, body });
      await refreshOrders();
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  return (
    <div className="app">
      <div className="topbar">
        <h1>
          CampusStore Admin
          {role && <span className={`badge badge-${role}`}>{role}</span>}
        </h1>
        {auth && (
          <button className="btn-ghost" onClick={handleLogout}>
            Log out ({auth.user.email})
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {!auth ? (
        <LoginCard onAzureLogin={handleAzureLogin} />
      ) : (
        <>
          {role === 'STUDENT' && (
            <OrdersPanel role={role} products={products} orders={orders} onPlaceOrder={handlePlaceOrder} />
          )}
          <CategoriesPanel
            categories={categories}
            role={role}
            onCreate={handleCreateCategory}
            onDelete={handleDeleteCategory}
          />
          <ProductsPanel
            products={products}
            categories={categories}
            role={role}
            onCreate={handleCreateProduct}
            onDelete={handleDeleteProduct}
          />
          {role === 'STAFF' && (
            <OrdersPanel role={role} products={products} orders={orders} onPlaceOrder={handlePlaceOrder} />
          )}
        </>
      )}
    </div>
  );
}
