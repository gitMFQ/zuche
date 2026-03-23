import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

// 导入控制器
import * as authController from '../controllers/auth.js';
import * as usersController from '../controllers/users.js';
import * as customersController from '../controllers/customers.js';
import * as vehiclesController from '../controllers/vehicles.js';
import * as ordersController from '../controllers/orders.js';
import * as violationsController from '../controllers/violations.js';
import * as blacklistController from '../controllers/blacklist.js';
import * as dashboardController from '../controllers/dashboard.js';
import * as orderSourcesController from '../controllers/orderSources.js';
import * as maintenanceController from '../controllers/maintenance.js';
import * as insuranceController from '../controllers/insurance.js';
import * as inspectionController from '../controllers/inspection.js';
import * as settingsController from '../controllers/settings.js';
import * as logsController from '../controllers/logs.js';

const router = Router();

// ==================== 认证路由 ====================
router.post('/auth/login', authController.login);
router.get('/auth/me', authMiddleware, authController.getCurrentUser);
router.put('/auth/password', authMiddleware, authController.changePassword);

// ==================== 用户管理路由 ====================
router.get('/users', authMiddleware, adminOnly, usersController.getUsers);
router.get('/users/:id', authMiddleware, usersController.getUser);
router.post('/users', authMiddleware, adminOnly, usersController.createUser);
router.put('/users/:id', authMiddleware, adminOnly, usersController.updateUser);
router.delete('/users/:id', authMiddleware, adminOnly, usersController.deleteUser);
router.put('/users/:id/reset-password', authMiddleware, adminOnly, usersController.resetPassword);

// ==================== 客户管理路由 ====================
router.get('/customers', authMiddleware, customersController.getCustomers);
router.get('/customers/regular', authMiddleware, customersController.getRegularCustomers);
router.get('/customers/:id', authMiddleware, customersController.getCustomer);
router.post('/customers', authMiddleware, customersController.createCustomer);
router.put('/customers/:id', authMiddleware, customersController.updateCustomer);
router.put('/customers/:id/regular', authMiddleware, customersController.setRegularCustomer);
router.delete('/customers/:id', authMiddleware, customersController.deleteCustomer);

// ==================== 车辆管理路由 ====================
router.get('/vehicles', authMiddleware, vehiclesController.getVehicles);
router.get('/vehicles/available', authMiddleware, vehiclesController.getAvailableVehicles);
router.get('/vehicles/brands', authMiddleware, vehiclesController.getVehicleBrands);
router.get('/vehicles/:id', authMiddleware, vehiclesController.getVehicle);
router.post('/vehicles', authMiddleware, vehiclesController.createVehicle);
router.put('/vehicles/:id', authMiddleware, vehiclesController.updateVehicle);
router.delete('/vehicles/:id', authMiddleware, vehiclesController.deleteVehicle);

// ==================== 订单管理路由 ====================
router.get('/orders', authMiddleware, ordersController.getOrders);
router.get('/orders/:id', authMiddleware, ordersController.getOrder);
router.post('/orders', authMiddleware, ordersController.createOrder);
router.put('/orders/:id', authMiddleware, ordersController.updateOrder);
router.put('/orders/:id/extend', authMiddleware, ordersController.extendOrder);
router.put('/orders/:id/status', authMiddleware, ordersController.updateOrderStatus);
router.post('/orders/:id/payments', authMiddleware, ordersController.addPayment);
router.put('/orders/:id/cancel', authMiddleware, ordersController.cancelOrder);

// ==================== 违章管理路由 ====================
router.get('/violations', authMiddleware, violationsController.getViolations);
router.get('/violations/stats', authMiddleware, violationsController.getViolationStats);
router.get('/violations/:id', authMiddleware, violationsController.getViolation);
router.post('/violations', authMiddleware, violationsController.createViolation);
router.put('/violations/:id', authMiddleware, violationsController.updateViolation);
router.put('/violations/:id/fee', authMiddleware, violationsController.collectFee);
router.put('/violations/:id/handle', authMiddleware, violationsController.handleViolation);
router.delete('/violations/:id', authMiddleware, violationsController.deleteViolation);

// ==================== 黑名单路由 ====================
router.get('/blacklist', authMiddleware, blacklistController.getBlacklist);
router.get('/blacklist/check', authMiddleware, blacklistController.checkBlacklist);
router.get('/blacklist/:id', authMiddleware, blacklistController.getBlacklistDetail);
router.post('/blacklist', authMiddleware, blacklistController.addToBlacklist);
router.delete('/blacklist/:id', authMiddleware, blacklistController.removeFromBlacklist);

// ==================== 订单来源路由 ====================
router.get('/order-sources', authMiddleware, orderSourcesController.getOrderSources);
router.get('/order-sources/:id', authMiddleware, orderSourcesController.getOrderSource);
router.post('/order-sources', authMiddleware, adminOnly, orderSourcesController.createOrderSource);
router.put('/order-sources/:id', authMiddleware, adminOnly, orderSourcesController.updateOrderSource);
router.delete('/order-sources/:id', authMiddleware, adminOnly, orderSourcesController.deleteOrderSource);

// ==================== 仪表盘路由 ====================
router.get('/dashboard/stats', authMiddleware, dashboardController.getDashboardStats);
router.get('/dashboard/income', authMiddleware, dashboardController.getIncomeReport);

// ==================== 保养管理路由 ====================
router.get('/maintenance', authMiddleware, maintenanceController.getMaintenanceList);
router.get('/maintenance/stats', authMiddleware, maintenanceController.getMaintenanceStats);
router.get('/maintenance/:id', authMiddleware, maintenanceController.getMaintenance);
router.post('/maintenance', authMiddleware, maintenanceController.createMaintenance);
router.put('/maintenance/:id', authMiddleware, maintenanceController.updateMaintenance);
router.delete('/maintenance/:id', authMiddleware, maintenanceController.deleteMaintenance);

// ==================== 保险管理路由 ====================
router.get('/insurance', authMiddleware, insuranceController.getInsuranceList);
router.get('/insurance/stats', authMiddleware, insuranceController.getInsuranceStats);
router.get('/insurance/:id', authMiddleware, insuranceController.getInsurance);
router.post('/insurance', authMiddleware, insuranceController.createInsurance);
router.put('/insurance/:id', authMiddleware, insuranceController.updateInsurance);
router.delete('/insurance/:id', authMiddleware, insuranceController.deleteInsurance);

// ==================== 年检证管理路由 ====================
router.get('/inspections', authMiddleware, inspectionController.getInspectionList);
router.get('/inspections/stats', authMiddleware, inspectionController.getInspectionStats);
router.post('/inspections', authMiddleware, inspectionController.createInspection);
router.put('/inspections/:vehicle_id', authMiddleware, inspectionController.updateInspection);
router.delete('/inspections/:vehicle_id', authMiddleware, inspectionController.deleteInspection);

// ==================== 系统设置路由 ====================
router.get('/settings', authMiddleware, settingsController.getSettings);
router.get('/settings/:key', authMiddleware, settingsController.getSetting);
router.put('/settings', authMiddleware, adminOnly, settingsController.updateSettings);

// ==================== 操作日志路由 ====================
router.get('/logs', authMiddleware, adminOnly, logsController.getLogs);
router.get('/logs/action-types', authMiddleware, logsController.getActionTypes);
router.get('/logs/entity-types', authMiddleware, logsController.getEntityTypes);
router.get('/logs/users', authMiddleware, logsController.getLogUsers);
router.get('/logs/:id', authMiddleware, adminOnly, logsController.getLog);

export default router;
