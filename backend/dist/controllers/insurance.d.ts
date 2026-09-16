import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare function getInsuranceList(req: AuthRequest, res: Response): void;
export declare function getInsuranceStats(req: AuthRequest, res: Response): void;
export declare function getInsurance(req: AuthRequest, res: Response): void;
export declare function createInsurance(req: AuthRequest, res: Response): void;
export declare function updateInsurance(req: AuthRequest, res: Response): void;
export declare function deleteInsurance(req: AuthRequest, res: Response): void;
