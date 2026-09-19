// Real Azure AD OIDC integration (MSAL Node, auth-code flow). Instantiation
// is lazy so a missing AD_CLIENT_ID doesn't crash the whole server while
// AUTH_MODE=mock is in use (proposal Wk3 wires this up for real).
const { ConfidentialClientApplication } = require('@azure/msal-node');

let msalApp;
function getMsalApp() {
  if (!msalApp) {
    msalApp = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.AD_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.AD_TENANT_ID}`,
        clientSecret: process.env.AD_CLIENT_SECRET,
      },
    });
  }
  return msalApp;
}

// Maps AD security-group membership to an internal role (proposal §5/§6).
function mapGroupsToRole(groupIds) {
  const staffGroup = process.env.AD_STAFF_GROUP_ID;
  if (staffGroup && groupIds.includes(staffGroup)) return 'STAFF';
  return 'STUDENT';
}

// The ID token has no "department" claim (not a standard Entra ID optional
// claim) — the peer discount check needs it, so fetch it from Graph /me
// with the Graph access token acquired alongside the ID token.
async function fetchDepartment(graphAccessToken) {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=department', {
      headers: { Authorization: `Bearer ${graphAccessToken}` },
    });
    if (!response.ok) return null;
    const profile = await response.json();
    return profile.department || null;
  } catch (error) {
    console.warn(`Graph /me lookup failed: ${error.message}`);
    return null;
  }
}

module.exports = { getMsalApp, mapGroupsToRole, fetchDepartment };
