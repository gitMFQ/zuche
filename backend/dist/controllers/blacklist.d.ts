import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare function getBlacklist(req: AuthRequest, res: Response): void;
export declare function checkBlacklist(req: AuthRequest, res: Response): void;
export declare function addToBlacklist(req: AuthRequest, res: Response): void;
export declare function removeFromBlacklist(req: AuthRequest, res: Response): void;
export declare function getBlacklistDetail(req: AuthRequest, res: Response): void;
