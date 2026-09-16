import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare function login(req: Request, res: Response): Promise<void>;
export declare function getCurrentUser(req: AuthRequest, res: Response): void;
export declare function changePassword(req: AuthRequest, res: Response): void;
