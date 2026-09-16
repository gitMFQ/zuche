export declare function generateId(): string;
export declare function generateOrderNo(): string;
export declare function formatDate(date: Date | string): string;
export declare function now(): string;
export declare function logAction(userId: string, action: string, entityType?: string, entityId?: string, details?: string, ipAddress?: string): void;
export declare function query(sql: string, params?: any[]): any[];
export declare function execute(sql: string, params?: any[]): {
    changes: number;
    lastInsertRowId: number | bigint;
};
export declare function queryOne(sql: string, params?: any[]): any | null;
export declare function queryWithPagination(sql: string, params?: any[], page?: number, pageSize?: number): {
    data: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};
