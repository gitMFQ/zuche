import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare function getLogs(req: AuthRequest, res: Response): void;
export declare function getLog(req: AuthRequest, res: Response): void;
export declare function getActionTypes(req: AuthRequest, res: Response): void;
export declare function getEntityTypes(req: AuthRequest, res: Response): void;
export declare function getLogUsers(req: AuthRequest, res: Response): void;
