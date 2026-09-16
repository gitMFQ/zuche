import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
export declare function getUsers(req: AuthRequest, res: Response): void;
export declare function getUser(req: AuthRequest, res: Response): void;
export declare function createUser(req: AuthRequest, res: Response): void;
export declare function updateUser(req: AuthRequest, res: Response): void;
export declare function deleteUser(req: AuthRequest, res: Response): void;
export declare function resetPassword(req: AuthRequest, res: Response): void;
