import { Router } from 'express';
import warehouses from './warehouses.js';
import products from './products.js';
import people from './people.js';
import purchases from './purchases.js';
import sales from './sales.js';
import quotations from './quotations.js';
import deliveries from './deliveries.js';
import pos from './pos.js';
import support from './support.js';
import heavy from './heavy.js';
import rentals from './rentals.js';
import publicRoutes from './public.js';
import currencies from './currencies.js';
import taxes from './taxes.js';
import settings from './settings.js';

const router = Router();

router.use('/warehouses', warehouses);
router.use('/products', products);
router.use('/people', people);
router.use('/currencies', currencies);
router.use('/taxes', taxes);
router.use('/settings', settings);
router.use('/purchases', purchases);
router.use('/sales', sales);
router.use('/quotations', quotations);
router.use('/deliveries', deliveries);
router.use('/pos', pos);
router.use('/support', support);
router.use('/heavy', heavy);
router.use('/rentals', rentals);
router.use('/public', publicRoutes);

export default router;
