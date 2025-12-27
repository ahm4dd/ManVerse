import { Router } from 'express';
import { searchManhwas } from '../controllers/manhwas.controller.ts';

const manhwasRouter = Router();
manhwasRouter.get('/', searchManhwas);

export default manhwasRouter;
