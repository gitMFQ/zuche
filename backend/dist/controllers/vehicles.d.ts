import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare function getVehicles(req: AuthRequest, res: Response): void;
export declare function getAvailableVehicles(req: AuthRequest, res: Response): void;
export declare function getVehicle(req: AuthRequest, res: Response): void;
export declare function createVehicle(req: AuthRequest, res: Response): void;
export declare function updateVehicle(req: AuthRequest, res: Response): void;
export declare function deleteVehicle(req: AuthRequest, res: Response): void;
export declare function getVehicleBrands(req: AuthRequest, res: Response): void;
