const express = require('express');
const prisma = require('../lib/prisma');
const { verifyJwt, requireRole } = require('../middleware/auth');
const { verifyDepartmentEnrollment } = require('../services/peerClient');

const router = express.Router();

// AD's free-text department field and a product's discountDepartment tag
// won't always be written the same way ("CS" vs "Computer Science") — map
// known variants to one canonical form before comparing them.
const DEPARTMENT_ALIASES = {
  cs: 'computer science',
  'comp sci': 'computer science',
  compsci: 'computer science',
  'computer science': 'computer science',
};

function normalizeDepartment(name) {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return DEPARTMENT_ALIASES[key] || key;
}

router.use(verifyJwt);

// Any authenticated user places an order for themselves.
router.post('/', async (req, res) => {
  try {
    const { items } = req.body; // items: [{ productId, quantity }]
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items is required' });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i) => parseInt(i.productId)) } },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    // No student-entered discount code — eligibility is derived entirely
    // from what's in the cart (a product tagged with a discountDepartment)
    // against the buyer's own AD department claim (proposal §9.2's "CS
    // jacket" scenario). A product can only ever discount itself.
    let totalAmount = 0;
    let hasEligibleItem = false;
    const orderItemsData = items.map((i) => {
      const productId = parseInt(i.productId);
      const product = productById.get(productId);
      if (!product) throw new Error(`Unknown productId ${productId}`);
      const unitPrice = Number(product.basePrice);
      const lineTotal = unitPrice * i.quantity;

      const isEligible =
        product.discountDepartment &&
        req.user.department &&
        normalizeDepartment(product.discountDepartment) === normalizeDepartment(req.user.department);
      if (isEligible) hasEligibleItem = true;

      totalAmount += lineTotal;
      return { productId, quantity: i.quantity, unitPrice, lineTotal, isEligible };
    });

    // Verification is a single live call against the partner enrollment API
    // (only made when the cart actually contains a department-tagged item —
    // no point calling out for an all-generic-merch order). Fail-closed per
    // proposal §9.2 — any partner failure just skips the discount.
    let discountApplied = false;
    if (hasEligibleItem) {
      const eligible = await verifyDepartmentEnrollment({
        studentId: req.user.id,
        department: req.user.department,
      });
      if (eligible) {
        for (const item of orderItemsData) {
          if (item.isEligible) totalAmount -= item.lineTotal * 0.1;
        }
        discountApplied = true;
      }
    }

    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
        totalAmount,
        discountApplied,
        items: {
          create: orderItemsData.map(({ productId, quantity, unitPrice }) => ({
            productId,
            quantity,
            unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error(error);
    res.status(400).json({ success: false, error: error.message || 'Order creation failed' });
  }
});

router.get('/mine', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// STAFF can see every order, not just their own.
router.get('/', requireRole('STAFF'), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: { items: true, user: { select: { id: true, email: true, department: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

module.exports = router;
