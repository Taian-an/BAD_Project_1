const express = require('express');
const prisma = require('../lib/prisma');
const { verifyJwt, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const category = await prisma.category.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!category) return res.status(404).json({ success: false, error: 'Category not found' });
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/', verifyJwt, requireRole('STAFF', 'ADMIN'), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const category = await prisma.category.create({ data: { name, description } });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Insert failed' });
  }
});

router.put('/:id', verifyJwt, requireRole('STAFF', 'ADMIN'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const category = await prisma.category.update({
      where: { id: parseInt(req.params.id) },
      data: { name, description },
    });
    res.json({ success: true, data: category });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, error: 'Category not found' });
    res.status(500).json({ success: false, error: 'Update failed' });
  }
});

router.delete('/:id', verifyJwt, requireRole('STAFF', 'ADMIN'), async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, error: 'Category not found' });
    // FK constraint: existing products still reference this category.
    if (error.code === 'P2003') {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete: this category still has products in it',
      });
    }
    res.status(500).json({ success: false, error: 'Delete failed' });
  }
});

module.exports = router;
