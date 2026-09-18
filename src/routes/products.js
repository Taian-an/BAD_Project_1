const express = require('express');
const prisma = require('../lib/prisma');
const { verifyJwt, requireRole } = require('../middleware/auth');
const { generateDescription } = require('../services/ai');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const products = await prisma.product.findMany({ include: { category: true } });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { category: true },
    });
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// STAFF/ADMIN create a product; an AI call generates the SEO-friendly
// storefront description that's actually shown to students (proposal §8).
router.post('/', verifyJwt, requireRole('STAFF', 'ADMIN'), async (req, res) => {
  try {
    const { name, basePrice, stockQty, imageUrl, description, categoryId, discountDepartment } = req.body;
    if (!name || basePrice === undefined || !categoryId) {
      return res.status(400).json({ error: 'name, basePrice, and categoryId are required' });
    }

    const aiDescription = await generateDescription({ name, category: categoryId, notes: description });

    const product = await prisma.product.create({
      data: {
        name,
        basePrice,
        stockQty: stockQty || 0,
        imageUrl,
        description,
        aiDescription,
        discountDepartment: discountDepartment || null,
        categoryId: parseInt(categoryId),
        createdById: req.user.id,
      },
    });
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Insert failed' });
  }
});

router.put('/:id', verifyJwt, requireRole('STAFF', 'ADMIN'), async (req, res) => {
  try {
    const { name, basePrice, stockQty, imageUrl, description, categoryId, discountDepartment } = req.body;
    const data = { name, basePrice, stockQty, imageUrl, description };
    if (discountDepartment !== undefined) data.discountDepartment = discountDepartment || null;
    if (categoryId) data.categoryId = parseInt(categoryId);
    if (description) {
      data.aiDescription = await generateDescription({ name, category: categoryId, notes: description });
    }

    const product = await prisma.product.update({ where: { id: parseInt(req.params.id) }, data });
    res.json({ success: true, data: product });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, error: 'Product not found' });
    res.status(500).json({ success: false, error: 'Update failed' });
  }
});

router.delete('/:id', verifyJwt, requireRole('STAFF', 'ADMIN'), async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, error: 'Product not found' });
    // FK constraint: existing order items reference this product — deleting
    // it would corrupt past orders' line items, so it's refused, not cascaded.
    if (error.code === 'P2003') {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete: this product has existing orders',
      });
    }
    res.status(500).json({ success: false, error: 'Delete failed' });
  }
});

module.exports = router;
