import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare function getOrderSources(req: AuthRequest, res: Response): void;
export declare function getOrderSource(req: AuthRequest, res: Response): void;
export declare function createOrderSource(req: AuthRequest, res: Response): void;
export declare function updateOrderSource(req: AuthRequest, res: Response): void;
export declare function deleteOrderSource(req: AuthRequest, res: Response): void;
