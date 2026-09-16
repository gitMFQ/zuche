import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare function getMaintenanceList(req: AuthRequest, res: Response): void;
export declare function getMaintenanceStats(req: AuthRequest, res: Response): void;
export declare function getMaintenance(req: AuthRequest, res: Response): void;
export declare function createMaintenance(req: AuthRequest, res: Response): void;
export declare function updateMaintenance(req: AuthRequest, res: Response): void;
export declare function deleteMaintenance(req: AuthRequest, res: Response): void;
