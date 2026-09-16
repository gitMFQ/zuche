import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        role: string;
        name: string;
    };
}
export declare function generateToken(user: {
    id: string;
    username: string;
    role: string;
    name: string;
}): string;
export declare function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void;
export declare function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void;
