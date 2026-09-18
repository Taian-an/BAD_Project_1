const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const router = express.Router();

function issueJwt(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, department: user.department, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
}

async function upsertUserFromAd({ adObjectId, email, displayName, role, department }) {
  return prisma.user.upsert({
    where: { adObjectId },
    update: { email, displayName, role, department },
    create: { adObjectId, email, displayName, role, department },
  });
}

// DEV-ONLY: bypasses real Azure AD so the AD->JWT->RBAC chain can be built
// and tested before the Azure AD app registration exists (proposal Wk1/Wk3).
// Disabled unless AUTH_MODE=mock.
router.post('/dev-login', async (req, res) => {
  if (process.env.AUTH_MODE !== 'mock') {
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    const { email, displayName, role, department } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const finalRole = ['STUDENT', 'STAFF', 'ADMIN'].includes(role) ? role : 'STUDENT';
    const user = await upsertUserFromAd({
      adObjectId: `mock-${email}`,
      email,
      displayName: displayName || email,
      role: finalRole,
      department: department || null,
    });

    const token = issueJwt(user);
    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, role: user.role, department: user.department },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Dev login failed' });
  }
});

// Real Azure AD OIDC flow (proposal §6). Requires AD_CLIENT_ID/AD_TENANT_ID/
// AD_CLIENT_SECRET/AD_REDIRECT_URI once the app registration is granted.
router.get('/login', async (req, res) => {
  if (process.env.AUTH_MODE === 'mock') {
    return res.status(400).json({ error: 'AUTH_MODE=mock — use POST /auth/dev-login instead' });
  }
  const { getMsalApp } = require('../services/msal');
  const authUrl = await getMsalApp().getAuthCodeUrl({
    scopes: ['user.read'],
    redirectUri: process.env.AD_REDIRECT_URI,
  });
  res.redirect(authUrl);
});

router.get('/callback', async (req, res) => {
  try {
    const { getMsalApp, mapGroupsToRole, fetchDepartment } = require('../services/msal');
    const tokenResponse = await getMsalApp().acquireTokenByCode({
      code: req.query.code,
      scopes: ['user.read'],
      redirectUri: process.env.AD_REDIRECT_URI,
    });

    const claims = tokenResponse.idTokenClaims;
    const role = mapGroupsToRole(claims.groups || []);
    const department = claims.department || (await fetchDepartment(tokenResponse.accessToken));
    const user = await upsertUserFromAd({
      adObjectId: claims.oid,
      email: claims.preferred_username || claims.email,
      displayName: claims.name,
      role,
      department,
    });

    const token = issueJwt(user);
    // Hand the token to the SPA via the URL fragment (never sent to any
    // server, unlike a query string) rather than rendering JSON here — the
    // frontend picks it up from location.hash on load (see App.jsx).
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/#token=${token}`);
  } catch (error) {
    console.error(error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/#error=${encodeURIComponent('AD login failed')}`);
  }
});

module.exports = router;
