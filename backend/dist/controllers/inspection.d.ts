import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare function getInspectionList(req: AuthRequest, res: Response): void;
export declare function getInspectionStats(req: AuthRequest, res: Response): void;
export declare function createInspection(req: AuthRequest, res: Response): void;
export declare function updateInspection(req: AuthRequest, res: Response): void;
export declare function deleteInspection(req: AuthRequest, res: Response): void;
