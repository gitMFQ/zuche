import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare function getRecentSchedules(req: AuthRequest, res: Response): void;
export declare function getGanttData(req: AuthRequest, res: Response): void;
