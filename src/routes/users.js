const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { verifyJwt, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(verifyJwt, requireRole('STAFF'));

router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, displayName: true, role: true, department: true, createdAt: true },
  });
  res.json({ success: true, data: users });
});

router.put('/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['STUDENT', 'STAFF'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const user = await prisma.user.update({ where: { id: parseInt(req.params.id) }, data: { role } });
    res.json({ success: true, data: user });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'User not found' });
    res.status(500).json({ error: 'Update failed' });
  }
});

// Issues a new peer API key for a partner. The raw key is returned exactly
// once — only its hash is ever stored (proposal §7/§9.1).
router.post('/peer-keys', async (req, res) => {
  try {
    const { partnerName, description } = req.body;
    if (!partnerName) return res.status(400).json({ error: 'partnerName is required' });

    const rawKey = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const record = await prisma.peerApiKeyIssued.create({
      data: { partnerName, keyHash, description, isActive: true },
    });

    res.status(201).json({ success: true, data: { id: record.id, partnerName, apiKey: rawKey } });
  } catch (error) {
    res.status(500).json({ error: 'Key issuance failed' });
  }
});

router.delete('/peer-keys/:id', async (req, res) => {
  try {
    await prisma.peerApiKeyIssued.update({ where: { id: parseInt(req.params.id) }, data: { isActive: false } });
    res.json({ success: true, message: 'Key revoked' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Key not found' });
    res.status(500).json({ error: 'Revoke failed' });
  }
});

module.exports = router;
