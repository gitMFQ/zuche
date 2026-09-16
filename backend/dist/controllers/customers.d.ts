import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare function getCustomers(req: AuthRequest, res: Response): void;
export declare function getCustomer(req: AuthRequest, res: Response): void;
export declare function createCustomer(req: AuthRequest, res: Response): void;
export declare function updateCustomer(req: AuthRequest, res: Response): void;
export declare function deleteCustomer(req: AuthRequest, res: Response): void;
export declare function getRegularCustomers(req: AuthRequest, res: Response): void;
export declare function setRegularCustomer(req: AuthRequest, res: Response): void;
