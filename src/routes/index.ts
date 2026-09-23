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
import * as ownersController from '../controllers/owners';
import * as financeController from '../controllers/finance';
import * as expensesController from '../controllers/expenses';
import * as settlementController from '../controllers/settlement';
import * as reportsController from '../controllers/reports';

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

// ==================== 车主 ====================
// 静态段（/options）必须排在同级 /:id 之前，否则会被参数路由捕获
apiRoutes.get('/owners/options', authMiddleware, ownersController.getOwnerOptions);
apiRoutes.get('/owners', authMiddleware, ownersController.getOwners);
apiRoutes.get('/owners/:id', authMiddleware, ownersController.getOwner);
apiRoutes.get('/owners/:id/statement', authMiddleware, ownersController.getOwnerStatement);
apiRoutes.get('/owners/:id/advances', authMiddleware, ownersController.getOwnerAdvances);
apiRoutes.post('/owners/:id/advances', authMiddleware, ownersController.createAdvance);
apiRoutes.put('/owners/:id/advances/:advanceId', authMiddleware, ownersController.updateAdvance);
apiRoutes.put('/owners/:id/advances/:advanceId/pay', authMiddleware, ownersController.payAdvance);
apiRoutes.delete('/owners/:id/advances/:advanceId', authMiddleware, adminOnly, ownersController.deleteAdvance);
// 车主档案的增删改只给管理员：费率直接决定结算金额，属于财务配置
apiRoutes.post('/owners', authMiddleware, adminOnly, ownersController.createOwner);
apiRoutes.put('/owners/:id', authMiddleware, adminOnly, ownersController.updateOwner);
apiRoutes.delete('/owners/:id', authMiddleware, adminOnly, ownersController.deleteOwner);

// ==================== 资金账户与流水 ====================
apiRoutes.get('/finance/accounts', authMiddleware, financeController.getFundAccounts);
apiRoutes.get('/finance/accounts/:id', authMiddleware, financeController.getFundAccount);
apiRoutes.post('/finance/accounts', authMiddleware, adminOnly, financeController.createFundAccount);
apiRoutes.put('/finance/accounts/:id', authMiddleware, adminOnly, financeController.updateFundAccount);
apiRoutes.delete('/finance/accounts/:id', authMiddleware, adminOnly, financeController.deleteFundAccount);
apiRoutes.get('/finance/transactions', authMiddleware, financeController.getFundTransactions);
apiRoutes.post('/finance/transactions', authMiddleware, financeController.createFundTransaction);
apiRoutes.put('/finance/transactions/:id', authMiddleware, adminOnly, financeController.updateFundTransaction);
apiRoutes.put('/finance/transactions/:id/account', authMiddleware, adminOnly, financeController.reassignFundTransaction);
apiRoutes.post('/finance/transactions/:id/reverse', authMiddleware, adminOnly, financeController.reverseFundTransaction);
apiRoutes.get('/finance/transfers', authMiddleware, financeController.getFundTransfers);
apiRoutes.post('/finance/transfers', authMiddleware, adminOnly, financeController.createTransfer);
apiRoutes.get('/finance/summary', authMiddleware, financeController.getFundSummary);
apiRoutes.get('/finance/period-locks', authMiddleware, financeController.getPeriodLocks);
apiRoutes.put('/finance/period-locks/:period', authMiddleware, adminOnly, financeController.lockPeriod);
apiRoutes.delete('/finance/period-locks/:period', authMiddleware, adminOnly, financeController.unlockPeriod);

// ==================== 费用台账 ====================
// 财务模块的字典（账户 + 开支项目 + 车辆费用类型 + 车主选项），前端首屏一次拉完
apiRoutes.get('/finance/dicts', authMiddleware, expensesController.getFinanceDicts);

// 车辆费用：记账对所有人开放（门店员工天天要记洗车/补油/过路费），
// 但删除只给管理员，避免随手删掉已经入账的费用
apiRoutes.get('/vehicle-expenses/stats', authMiddleware, expensesController.getVehicleExpenseStats);
apiRoutes.get('/vehicle-expenses', authMiddleware, expensesController.getVehicleExpenses);
apiRoutes.post('/vehicle-expenses', authMiddleware, expensesController.createVehicleExpense);
apiRoutes.put('/vehicle-expenses/:id', authMiddleware, expensesController.updateVehicleExpense);
apiRoutes.put('/vehicle-expenses/:id/pay', authMiddleware, expensesController.payVehicleExpense);
apiRoutes.put('/vehicle-expenses/:id/unpay', authMiddleware, adminOnly, expensesController.unpayVehicleExpense);
apiRoutes.delete('/vehicle-expenses/:id', authMiddleware, adminOnly, expensesController.deleteVehicleExpense);

// 运营开支
apiRoutes.get('/operating-expenses/stats', authMiddleware, expensesController.getOperatingExpenseStats);
apiRoutes.get('/operating-expenses', authMiddleware, expensesController.getOperatingExpenses);
apiRoutes.post('/operating-expenses', authMiddleware, expensesController.createOperatingExpense);
apiRoutes.put('/operating-expenses/:id', authMiddleware, expensesController.updateOperatingExpense);
apiRoutes.put('/operating-expenses/:id/pay', authMiddleware, expensesController.payOperatingExpense);
apiRoutes.put('/operating-expenses/:id/unpay', authMiddleware, adminOnly, expensesController.unpayOperatingExpense);
apiRoutes.delete('/operating-expenses/:id', authMiddleware, adminOnly, expensesController.deleteOperatingExpense);

// ==================== 车主结算 ====================
// 静态段必须排在 /:id 之前
apiRoutes.get('/settlements/lines', authMiddleware, settlementController.getSettlementLines);
apiRoutes.post('/settlements/lines', authMiddleware, settlementController.createSettlementLine);
// 生成与刷新会让整期金额变化，属于财务动作，只给管理员
apiRoutes.post('/settlements/lines/generate', authMiddleware, adminOnly, settlementController.generateSettlementLines);
apiRoutes.put('/settlements/lines/:id', authMiddleware, adminOnly, settlementController.updateSettlementLine);
apiRoutes.post('/settlements/lines/:id/void', authMiddleware, adminOnly, settlementController.voidSettlementLine);
apiRoutes.post('/settlements/lines/:id/restore', authMiddleware, adminOnly, settlementController.restoreSettlementLine);
apiRoutes.get('/settlements/openings', authMiddleware, settlementController.getSettlementOpenings);
apiRoutes.post('/settlements/openings', authMiddleware, adminOnly, settlementController.upsertSettlementOpening);
apiRoutes.delete('/settlements/openings/:id', authMiddleware, adminOnly, settlementController.deleteSettlementOpening);
apiRoutes.get('/settlements/payouts', authMiddleware, settlementController.getSettlementPayouts);
apiRoutes.post('/settlements/payouts', authMiddleware, adminOnly, settlementController.createSettlementPayout);
apiRoutes.delete('/settlements/payouts/:id', authMiddleware, adminOnly, settlementController.deleteSettlementPayout);

// ==================== 财务报表 ====================
// 报表口径见 src/controllers/reports.ts 的文件头（经营收入 / 结算收入 / 现金余额三条线）
apiRoutes.get('/reports/vehicle-monthly', authMiddleware, reportsController.getVehicleMonthlyReport);
apiRoutes.get('/reports/vehicle-ranking', authMiddleware, reportsController.getVehicleRanking);
apiRoutes.get('/reports/company-monthly', authMiddleware, reportsController.getCompanyMonthlyReport);
apiRoutes.get('/reports/fund-flow', authMiddleware, reportsController.getFundFlowReport);
apiRoutes.get('/reports/owner-statement', authMiddleware, reportsController.getOwnerStatementReport);

// ==================== 文件上传路由 ====================
apiRoutes.route('/', uploadRoutes);
