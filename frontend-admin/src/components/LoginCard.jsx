// Real Azure AD login, full-page-redirects to GET /auth/login. The backend
// rejects this unless AUTH_MODE=azuread (see server .env.local).
export default function LoginCard({ onAzureLogin }) {
  return (
    <div className="card login-card">
      <h2>CampusStore Admin</h2>
      <button type="button" className="btn-primary" onClick={onAzureLogin}>
        Log in with Azure AD
      </button>
    </div>
  );
}
