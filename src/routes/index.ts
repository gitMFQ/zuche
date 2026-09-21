import { Hono } from 'hono';
import { adminOnly, authMiddleware } from '../middleware/auth';
import type { AppEnv } from '../types';

import * as authController from '../controllers/auth';
import * as usersController from '../controllers/users';
import * as customersController from '../controllers/customers';
import * as vehiclesController from '../controllers/vehicles';
import * as ordersController from '../controllers/orders';
import * as violationsController from '../controllers/violations';
import * as blacklistController from '../controllers/blacklist';
import * as dashboardController from '../controllers/dashboard';
import * as orderSourcesController from '../controllers/orderSources';
import * as maintenanceController from '../controllers/maintenance';
import * as insuranceController from '../controllers/insurance';
import * as inspectionController from '../controllers/inspection';
import * as settingsController from '../controllers/settings';
import * as logsController from '../controllers/logs';
import * as schedulesController from '../controllers/schedules';
import * as importController from '../controllers/import';

import { uploadRoutes } from './upload';
import { signUploadUrls } from '../lib/uploadUrl';

export const apiRoutes = new Hono<AppEnv>();

// 统一把响应体里的上传路径替换成带签名的 URL。
// 图片字段散落在 8 个 controller 的十几个字段里（含 JSON 数组与 {url,type} 对象），
// 集中做一次避免逐字段手写漏签；必须注册在业务路由之前才能包住它们。
apiRoutes.use('*', signUploadUrls);

// ==================== 认证路由 ====================
apiRoutes.post('/auth/login', authController.login);
apiRoutes.get('/auth/me', authMiddleware, authController.getCurrentUser);
apiRoutes.put('/auth/password', authMiddleware, authController.changePassword);
apiRoutes.post('/auth/logout', authMiddleware, authController.logout);

// ==================== 用户管理路由 ====================
apiRoutes.get('/users', authMiddleware, adminOnly, usersController.getUsers);
// 只含 id/name，供司机指派等选人场景使用（员工也需要），必须放在 /users/:id 之前
apiRoutes.get('/users/options', authMiddleware, usersController.getUserOptions);
// 单个用户信息含手机号/邮箱，仅管理员可读
apiRoutes.get('/users/:id', authMiddleware, adminOnly, usersController.getUser);
apiRoutes.post('/users', authMiddleware, adminOnly, usersController.createUser);
apiRoutes.put('/users/:id', authMiddleware, adminOnly, usersController.updateUser);
apiRoutes.delete('/users/:id', authMiddleware, adminOnly, usersController.deleteUser);
apiRoutes.put('/users/:id/reset-password', authMiddleware, adminOnly, usersController.resetPassword);

// ==================== 客户管理路由 ====================
apiRoutes.get('/customers/regular', authMiddleware, customersController.getRegularCustomers);
apiRoutes.get('/customers', authMiddleware, customersController.getCustomers);
apiRoutes.get('/customers/:id', authMiddleware, customersController.getCustomer);
apiRoutes.post('/customers', authMiddleware, customersController.createCustomer);
apiRoutes.put('/customers/:id', authMiddleware, customersController.updateCustomer);
apiRoutes.put('/customers/:id/regular', authMiddleware, customersController.setRegularCustomer);
apiRoutes.delete('/customers/:id', authMiddleware, customersController.deleteCustomer);

// ==================== 车辆管理路由 ====================
apiRoutes.get('/vehicles/available', authMiddleware, vehiclesController.getAvailableVehicles);
apiRoutes.get('/vehicles/brands', authMiddleware, vehiclesController.getVehicleBrands);
apiRoutes.get('/vehicles/options', authMiddleware, vehiclesController.getVehicleFilterOptions);
apiRoutes.get('/vehicles', authMiddleware, vehiclesController.getVehicles);
apiRoutes.get('/vehicles/:id', authMiddleware, vehiclesController.getVehicle);
apiRoutes.post('/vehicles', authMiddleware, vehiclesController.createVehicle);
apiRoutes.put('/vehicles/:id', authMiddleware, vehiclesController.updateVehicle);
apiRoutes.delete('/vehicles/:id', authMiddleware, vehiclesController.deleteVehicle);

// ==================== 订单管理路由 ====================
apiRoutes.get('/orders', authMiddleware, ordersController.getOrders);
// 必须放在 /orders/:id 之前，否则会被参数路由捕获
apiRoutes.get('/orders/stats', authMiddleware, ordersController.getOrderStats);
apiRoutes.get('/orders/:id', authMiddleware, ordersController.getOrder);
apiRoutes.post('/orders', authMiddleware, ordersController.createOrder);
apiRoutes.put('/orders/:id', authMiddleware, ordersController.updateOrder);
apiRoutes.put('/orders/:id/extend', authMiddleware, ordersController.extendOrder);
apiRoutes.put('/orders/:id/status', authMiddleware, ordersController.updateOrderStatus);
apiRoutes.post('/orders/:id/payments', authMiddleware, ordersController.addPayment);
apiRoutes.put('/orders/:id/cancel', authMiddleware, ordersController.cancelOrder);
apiRoutes.delete('/orders/:id', authMiddleware, ordersController.deleteOrder);
apiRoutes.put('/orders/:id/drivers', authMiddleware, ordersController.assignDrivers);

// ==================== 批量导入路由 ====================
apiRoutes.post('/orders/import/preview', authMiddleware, importController.previewImport);
apiRoutes.post('/orders/import', authMiddleware, importController.commitImport);
apiRoutes.get('/orders/import/batches', authMiddleware, importController.getImportBatches);
apiRoutes.delete('/orders/import/batches/:id', authMiddleware, importController.rollbackImport);

// ==================== 违章管理路由 ====================
apiRoutes.get('/violations/stats', authMiddleware, violationsController.getViolationStats);
apiRoutes.get('/violations', authMiddleware, violationsController.getViolations);
apiRoutes.get('/violations/:id', authMiddleware, violationsController.getViolation);
apiRoutes.post('/violations', authMiddleware, violationsController.createViolation);
apiRoutes.put('/violations/:id', authMiddleware, violationsController.updateViolation);
apiRoutes.put('/violations/:id/fee', authMiddleware, violationsController.collectFee);
apiRoutes.put('/violations/:id/handle', authMiddleware, violationsController.handleViolation);
apiRoutes.delete('/violations/:id', authMiddleware, violationsController.deleteViolation);

// ==================== 黑名单路由 ====================
apiRoutes.get('/blacklist/check', authMiddleware, blacklistController.checkBlacklist);
apiRoutes.get('/blacklist', authMiddleware, blacklistController.getBlacklist);
apiRoutes.get('/blacklist/:id', authMiddleware, blacklistController.getBlacklistDetail);
apiRoutes.post('/blacklist', authMiddleware, blacklistController.addToBlacklist);
apiRoutes.delete('/blacklist/:id', authMiddleware, blacklistController.removeFromBlacklist);

// ==================== 订单来源路由 ====================
apiRoutes.get('/order-sources', authMiddleware, orderSourcesController.getOrderSources);
apiRoutes.get('/order-sources/:id', authMiddleware, orderSourcesController.getOrderSource);
apiRoutes.post('/order-sources', authMiddleware, adminOnly, orderSourcesController.createOrderSource);
apiRoutes.put('/order-sources/:id', authMiddleware, adminOnly, orderSourcesController.updateOrderSource);
apiRoutes.delete('/order-sources/:id', authMiddleware, adminOnly, orderSourcesController.deleteOrderSource);

// ==================== 仪表盘路由 ====================
apiRoutes.get('/dashboard/stats', authMiddleware, dashboardController.getDashboardStats);
apiRoutes.get('/dashboard/income', authMiddleware, dashboardController.getIncomeReport);

// ==================== 保养管理路由 ====================
apiRoutes.get('/maintenance/stats', authMiddleware, maintenanceController.getMaintenanceStats);
apiRoutes.get('/maintenance', authMiddleware, maintenanceController.getMaintenanceList);
apiRoutes.get('/maintenance/:id', authMiddleware, maintenanceController.getMaintenance);
apiRoutes.post('/maintenance', authMiddleware, maintenanceController.createMaintenance);
apiRoutes.put('/maintenance/:id', authMiddleware, maintenanceController.updateMaintenance);
apiRoutes.delete('/maintenance/:id', authMiddleware, maintenanceController.deleteMaintenance);

// ==================== 保险管理路由 ====================
apiRoutes.get('/insurance/stats', authMiddleware, insuranceController.getInsuranceStats);
apiRoutes.get('/insurance', authMiddleware, insuranceController.getInsuranceList);
apiRoutes.get('/insurance/:id', authMiddleware, insuranceController.getInsurance);
apiRoutes.post('/insurance', authMiddleware, insuranceController.createInsurance);
apiRoutes.put('/insurance/:id', authMiddleware, insuranceController.updateInsurance);
apiRoutes.delete('/insurance/:id', authMiddleware, insuranceController.deleteInsurance);

// ==================== 年检证管理路由 ====================
apiRoutes.get('/inspections/stats', authMiddleware, inspectionController.getInspectionStats);
apiRoutes.get('/inspections', authMiddleware, inspectionController.getInspectionList);
apiRoutes.post('/inspections', authMiddleware, inspectionController.createInspection);
apiRoutes.put('/inspections/:vehicle_id', authMiddleware, inspectionController.updateInspection);
apiRoutes.delete('/inspections/:vehicle_id', authMiddleware, inspectionController.deleteInspection);

// ==================== 系统设置路由 ====================
apiRoutes.get('/settings', authMiddleware, settingsController.getSettings);
apiRoutes.get('/settings/:key', authMiddleware, settingsController.getSetting);
apiRoutes.put('/settings', authMiddleware, adminOnly, settingsController.updateSettings);

// ==================== 操作日志路由 ====================
apiRoutes.get('/logs/action-types', authMiddleware, logsController.getActionTypes);
apiRoutes.get('/logs/entity-types', authMiddleware, logsController.getEntityTypes);
apiRoutes.get('/logs/users', authMiddleware, logsController.getLogUsers);
apiRoutes.get('/logs', authMiddleware, adminOnly, logsController.getLogs);
apiRoutes.get('/logs/:id', authMiddleware, adminOnly, logsController.getLog);

// ==================== 调度路由 ====================
apiRoutes.get('/schedules/recent', authMiddleware, schedulesController.getRecentSchedules);
apiRoutes.get('/schedules/gantt', authMiddleware, schedulesController.getGanttData);

// ==================== 文件上传路由 ====================
apiRoutes.route('/', uploadRoutes);
