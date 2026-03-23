<template>
  <div class="page-container">
    <!-- 标签页 -->
    <el-tabs v-model="activeTab" class="order-tabs" @tab-change="onTabChange">
      <el-tab-pane label="待取车" name="pending">
        <template #label>
          <span>待取车 <el-badge v-if="tabCounts.pending > 0" :value="tabCounts.pending" /></span>
        </template>
      </el-tab-pane>
      <el-tab-pane label="待还车" name="active">
        <template #label>
          <span>待还车 <el-badge v-if="tabCounts.active > 0" :value="tabCounts.active" /></span>
        </template>
      </el-tab-pane>
      <el-tab-pane label="已完成" name="completed" />
      <el-tab-pane label="已取消" name="cancelled" />
    </el-tabs>

    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm" size="default">
        <el-form-item>
          <el-input v-model="searchForm.keyword" placeholder="订单号/客户/车牌" clearable @keyup.enter="loadData" style="width: 150px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">搜索</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 操作栏 -->
    <div class="action-bar">
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon> 新建订单
      </el-button>
    </div>

    <!-- 移动端卡片列表 -->
    <div class="mobile-cards">
      <div v-for="item in tableData" :key="item.id" class="mobile-card" @click="goToDetail(item)">
        <div class="mobile-card-header">
          <span>
            <span v-if="item.source_name" class="source-tag" :style="{ background: item.source_color || '#409EFF' }">{{ item.source_name }}</span>
          </span>
          <el-tag :type="getStatusType(item.status)" size="small">{{ item.status_text }}</el-tag>
        </div>
        <div class="mobile-card-row">
          <span class="label">客户</span>
          <span class="value">{{ item.customer_name }} <a :href="'tel:' + item.customer_phone">{{ item.customer_phone }}</a></span>
        </div>
        <div class="mobile-card-row">
          <span class="label">车辆</span>
          <span class="value">
            <span class="plate-number" :class="item.is_new_energy ? 'new-energy' : 'fuel'">{{ item.plate_number }}</span>
            | {{ item.model }}
          </span>
        </div>
        <div class="mobile-card-row">
          <span class="label">取车</span>
          <span class="value">{{ formatDateTime(item.start_date) }}<span v-if="item.pickup_location" class="location-text"> ({{ item.pickup_location }})</span></span>
        </div>
        <div class="mobile-card-row">
          <span class="label">还车</span>
          <span class="value">{{ formatDateTime(item.end_date) }}<span v-if="item.return_location" class="location-text"> ({{ item.return_location }})</span></span>
        </div>
        <div class="mobile-card-footer">
          <span class="amount">¥{{ item.total_amount }}</span>
          <span class="paid" :class="{ 'text-warning': item.paid_amount < item.total_amount }">
            已付 ¥{{ item.paid_amount }}
          </span>
        </div>
        <div class="mobile-card-actions" @click.stop>
          <template v-if="item.status === 'pending'">
            <el-button type="primary" size="small" @click="openEditDialog(item)">编辑</el-button>
            <el-button type="success" size="small" @click="openPickupDialog(item)">取车</el-button>
            <el-button type="warning" size="small" @click="openPaymentDialog(item)">支付</el-button>
            <el-button type="danger" size="small" @click="handleCancel(item)">取消</el-button>
          </template>
          <template v-else-if="item.status === 'active'">
            <el-button type="primary" size="small" @click="openEditDialog(item)">编辑</el-button>
            <el-button type="success" size="small" @click="openReturnDialog(item)">还车</el-button>
            <el-button type="warning" size="small" @click="openExtendDialog(item)">续租</el-button>
            <el-button type="info" size="small" @click="openPaymentDialog(item)">支付</el-button>
            <el-button type="danger" size="small" @click="handleCancel(item)">取消</el-button>
          </template>
          <template v-else-if="item.status === 'completed'">
            <el-button type="primary" size="small" @click="openPaymentDialog(item)">支付</el-button>
            <el-button disabled size="small">已结束</el-button>
          </template>
          <el-button v-else disabled size="small">已结束</el-button>
        </div>
      </div>
    </div>

    <!-- PC端表格 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="tableData" v-loading="loading" stripe class="hide-mobile" @row-click="handleRowClick">
        <el-table-column prop="customer_name" label="客户" width="80" />
        <el-table-column prop="customer_phone" label="电话" width="110" />
        <el-table-column prop="plate_number" label="车牌" width="130">
          <template #default="{ row }">
            <span class="plate-number" :class="row.is_new_energy ? 'new-energy' : 'fuel'">{{ row.plate_number }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="start_date" label="取车" width="150">
          <template #default="{ row }">
            {{ formatDateTime(row.start_date) }}
            <span v-if="row.pickup_location" class="location-text">({{ row.pickup_location }})</span>
          </template>
        </el-table-column>
        <el-table-column prop="end_date" label="还车" width="150">
          <template #default="{ row }">
            {{ formatDateTime(row.end_date) }}
            <span v-if="row.return_location" class="location-text">({{ row.return_location }})</span>
          </template>
        </el-table-column>
        <el-table-column prop="total_amount" label="总金额" width="90">
          <template #default="{ row }">¥{{ row.total_amount }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ row.status_text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="source_name" label="来源" width="90">
          <template #default="{ row }">
            <span v-if="row.source_name" class="source-tag" :style="{ background: row.source_color || '#409EFF' }">{{ row.source_name }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="320">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button type="primary" link size="small" @click.stop="openEditDialog(row)">编辑</el-button>
              <el-button type="success" link size="small" @click.stop="openPickupDialog(row)">取车</el-button>
              <el-button type="warning" link size="small" @click.stop="openPaymentDialog(row)">支付</el-button>
              <el-button type="danger" link size="small" @click.stop="handleCancel(row)">取消</el-button>
            </template>
            <template v-else-if="row.status === 'active'">
              <el-button type="primary" link size="small" @click.stop="openEditDialog(row)">编辑</el-button>
              <el-button type="success" link size="small" @click.stop="openReturnDialog(row)">还车</el-button>
              <el-button type="warning" link size="small" @click.stop="openExtendDialog(row)">续租</el-button>
              <el-button type="info" link size="small" @click.stop="openPaymentDialog(row)">支付</el-button>
              <el-button type="danger" link size="small" @click.stop="handleCancel(row)">取消</el-button>
            </template>
            <template v-else-if="row.status === 'completed'">
              <el-button type="primary" link size="small" @click.stop="openPaymentDialog(row)">支付</el-button>
              <span class="text-muted">已结束</span>
            </template>
            <span v-else class="text-muted">已结束</span>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, prev, pager, next"
        background
        class="pagination"
        @size-change="loadData"
        @current-change="loadData"
      />
    </el-card>

    <!-- 新建订单对话框 -->
    <el-dialog v-model="dialogVisible" title="新建订单" width="90%" :style="{ maxWidth: '500px' }">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="70px" size="default">
        <el-divider content-position="left">客户信息</el-divider>
        <el-form-item label="常用客户">
          <el-select v-model="selectedRegularCustomer" placeholder="选择常用客户（可选）" style="width: 100%" clearable @change="onRegularCustomerChange">
            <el-option 
              v-for="c in regularCustomers" 
              :key="c.id" 
              :label="`${c.name} (${c.phone})`" 
              :value="c.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="姓名" prop="customer_name">
          <el-input v-model="form.customer_name" placeholder="客户姓名" />
        </el-form-item>
        <el-form-item label="手机" prop="customer_phone">
          <el-input v-model="form.customer_phone" placeholder="手机号" type="tel" @blur="checkBlacklist" />
        </el-form-item>
        <el-alert 
          v-if="blacklistWarning" 
          :title="blacklistWarning" 
          type="warning" 
          :closable="false"
          show-icon
          style="margin-bottom: 16px"
        >
          <template #default>
            <span>拉黑原因：{{ blacklistReason }}</span>
            <el-button type="warning" size="small" link @click="addToBlacklistFromOrder">继续下单并拉黑</el-button>
          </template>
        </el-alert>
        <el-form-item label="身份证">
          <el-input v-model="form.customer_id_card" placeholder="身份证号（可选）" />
        </el-form-item>
        <el-form-item label="身份证照片">
          <div class="mini-upload">
            <div class="image-list">
              <div v-for="(img, idx) in form.id_card_images" :key="idx" class="image-item">
                <img :src="getImageUrl(img)" @click="previewImage(form.id_card_images, idx)" />
                <div class="image-remove" @click="removeIdCardImage(idx)">×</div>
              </div>
              <div v-if="form.id_card_images.length < 2" class="upload-btn" @click="triggerUpload('id_card')">
                <el-icon><Plus /></el-icon>
              </div>
            </div>
            <input ref="idCardInput" type="file" accept="image/*" capture="environment" style="display: none" @change="handleUpload($event, 'id_card')" />
          </div>
        </el-form-item>
        <el-form-item label="驾驶证">
          <el-input v-model="form.customer_license" placeholder="驾驶证号（可选）" />
        </el-form-item>
        <el-form-item label="驾驶证照片">
          <div class="mini-upload">
            <div class="image-list">
              <div v-for="(img, idx) in form.license_images" :key="idx" class="image-item">
                <img :src="getImageUrl(img)" @click="previewImage(form.license_images, idx)" />
                <div class="image-remove" @click="removeLicenseImage(idx)">×</div>
              </div>
              <div v-if="form.license_images.length < 2" class="upload-btn" @click="triggerUpload('license')">
                <el-icon><Plus /></el-icon>
              </div>
            </div>
            <input ref="licenseInput" type="file" accept="image/*" capture="environment" style="display: none" @change="handleUpload($event, 'license')" />
          </div>
        </el-form-item>
        
        <el-divider content-position="left">车辆信息</el-divider>
        <el-form-item label="车辆" prop="vehicle_id">
          <el-select v-model="form.vehicle_id" placeholder="选择车辆" style="width: 100%" @change="onVehicleChange">
            <el-option 
              v-for="v in vehicles" 
              :key="v.id" 
              :label="`${v.plate_number} - ${v.brand} ${v.model} (¥${v.daily_rate}/天)`" 
              :value="v.id" 
            />
          </el-select>
        </el-form-item>
        
        <el-divider content-position="left">租期信息</el-divider>
        <el-form-item label="取车" prop="start_date">
          <input 
            type="datetime-local" 
            :value="formatDateTimeLocal(form.start_date)"
            class="native-datetime-input"
            @change="onStartDateTimeChange"
          />
        </el-form-item>
        <el-form-item label="还车" prop="end_date">
          <input 
            type="datetime-local" 
            :value="formatDateTimeLocal(form.end_date)"
            class="native-datetime-input"
            @change="onEndDateTimeChange"
          />
        </el-form-item>
        <el-form-item label="日租金">
          <el-input-number v-model="form.daily_rate" :min="0" placeholder="选填" style="width: 100%" />
        </el-form-item>
        <el-form-item label="总租金">
          <el-input-number v-model="form.total_amount" :min="0" placeholder="可直接填写总租金" style="width: 100%" />
        </el-form-item>
        <el-form-item label="预付">
          <el-switch v-model="form.has_prepay" />
        </el-form-item>
        <template v-if="form.has_prepay">
          <el-form-item label="支付金额">
            <el-input-number v-model="form.prepay_amount" :min="0" style="width: 100%" />
          </el-form-item>
          <el-form-item label="支付方式">
            <el-select v-model="form.prepay_method" placeholder="选择支付方式" style="width: 100%">
              <el-option v-for="item in PAYMENT_METHOD_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="支付类型">
            <el-select v-model="form.prepay_type" placeholder="选择支付类型" style="width: 100%">
              <el-option v-for="item in PAYMENT_TYPE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
        </template>
        <el-form-item label="免押">
          <el-switch v-model="form.deposit_waived" @change="onDepositWaivedChange" />
        </el-form-item>
        <el-form-item label="押金" v-if="!form.deposit_waived">
          <el-input-number v-model="form.deposit" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="免押到期" v-if="form.deposit_waived">
          <el-date-picker 
            v-model="form.deposit_waived_expiry" 
            type="date" 
            placeholder="免押到期日期" 
            value-format="YYYY-MM-DD"
            style="width: 100%" 
          />
        </el-form-item>
        <el-form-item label="服务类型">
          <el-radio-group v-model="form.service_type" class="service-radio-group">
            <el-radio-button value="basic">基础</el-radio-button>
            <el-radio-button value="premium">优享</el-radio-button>
            <el-radio-button value="vip">尊享</el-radio-button>
          </el-radio-group>
        </el-form-item>
        
        <el-divider content-position="left">订单来源</el-divider>
        <el-form-item label="来源" prop="source_id">
          <el-select v-model="form.source_id" placeholder="选择订单来源" style="width: 100%">
            <el-option 
              v-for="s in orderSources" 
              :key="s.id" 
              :label="`${s.name} (${s.commission_rate}%服务费)`" 
              :value="s.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="合同号">
          <el-input v-model="form.contract_number" placeholder="合同号（选填）" />
        </el-form-item>
        <el-form-item label="取车位置">
          <el-input v-model="form.pickup_location" placeholder="取车位置（选填）" />
        </el-form-item>
        <el-form-item label="还车位置">
          <el-input v-model="form.return_location" placeholder="还车位置（选填）" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remarks" type="textarea" :rows="2" placeholder="备注信息" />
        </el-form-item>
        <el-form-item label="预估">
          <span class="estimate">{{ estimatedDays }} 天，共 ¥{{ estimatedTotal }}</span>
          <span v-if="selectedSource" class="net-amount">，到账 ¥{{ netAmount }}</span>
          <el-tag v-if="form.service_type" :type="getServiceTagType(form.service_type)" size="small" style="margin-left: 8px">
            {{ getServiceLabel(form.service_type) }}
          </el-tag>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
    
    <!-- 编辑订单对话框 -->
    <el-dialog v-model="editDialogVisible" title="编辑订单" width="90%" :style="{ maxWidth: '500px' }">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="70px" size="default">
        <el-divider content-position="left">客户信息</el-divider>
        <el-form-item label="姓名" prop="customer_name">
          <el-input v-model="editForm.customer_name" placeholder="客户姓名" />
        </el-form-item>
        <el-form-item label="手机" prop="customer_phone">
          <el-input v-model="editForm.customer_phone" placeholder="手机号" type="tel" />
        </el-form-item>
        <el-form-item label="身份证">
          <el-input v-model="editForm.customer_id_card" placeholder="身份证号（可选）" />
        </el-form-item>
        <el-form-item label="身份证照片">
          <div class="mini-upload">
            <div class="image-list">
              <div v-for="(img, idx) in editForm.id_card_images" :key="idx" class="image-item">
                <img :src="getImageUrl(img)" @click="previewImage(editForm.id_card_images, idx)" />
                <div class="image-remove" @click="removeEditIdCardImage(idx)">×</div>
              </div>
              <div v-if="editForm.id_card_images.length < 2" class="upload-btn" @click="triggerEditUpload('id_card')">
                <el-icon><Plus /></el-icon>
              </div>
            </div>
            <input ref="editIdCardInput" type="file" accept="image/*" capture="environment" style="display: none" @change="handleEditUpload($event, 'id_card')" />
          </div>
        </el-form-item>
        <el-form-item label="驾驶证">
          <el-input v-model="editForm.customer_license" placeholder="驾驶证号（可选）" />
        </el-form-item>
        <el-form-item label="驾驶证照片">
          <div class="mini-upload">
            <div class="image-list">
              <div v-for="(img, idx) in editForm.license_images" :key="idx" class="image-item">
                <img :src="getImageUrl(img)" @click="previewImage(editForm.license_images, idx)" />
                <div class="image-remove" @click="removeEditLicenseImage(idx)">×</div>
              </div>
              <div v-if="editForm.license_images.length < 2" class="upload-btn" @click="triggerEditUpload('license')">
                <el-icon><Plus /></el-icon>
              </div>
            </div>
            <input ref="editLicenseInput" type="file" accept="image/*" capture="environment" style="display: none" @change="handleEditUpload($event, 'license')" />
          </div>
        </el-form-item>
        
        <el-divider content-position="left">车辆信息</el-divider>
        <el-form-item label="车辆" prop="vehicle_id">
          <el-select 
            v-model="editForm.vehicle_id" 
            placeholder="选择车辆" 
            style="width: 100%" 
            :disabled="currentOrder?.status === 'active'"
            @change="onEditVehicleChange"
          >
            <el-option 
              v-for="v in vehicles" 
              :key="v.id" 
              :label="`${v.plate_number} - ${v.brand} ${v.model} (¥${v.daily_rate}/天)`" 
              :value="v.id" 
            />
          </el-select>
        </el-form-item>
        
        <el-divider content-position="left">租期信息</el-divider>
        <el-form-item label="取车" prop="start_date">
          <input 
            type="datetime-local" 
            :value="formatDateTimeLocal(editForm.start_date)"
            class="native-datetime-input"
            @change="onEditStartDateTimeChange"
          />
        </el-form-item>
        <el-form-item label="还车" prop="end_date">
          <input 
            type="datetime-local" 
            :value="formatDateTimeLocal(editForm.end_date)"
            class="native-datetime-input"
            @change="onEditEndDateTimeChange"
          />
        </el-form-item>
        <el-form-item label="日租金">
          <el-input-number v-model="editForm.daily_rate" :min="0" placeholder="选填" style="width: 100%" />
        </el-form-item>
        <el-form-item label="总租金">
          <el-input-number v-model="editForm.total_amount" :min="0" placeholder="可直接填写总租金" style="width: 100%" />
        </el-form-item>
        <el-form-item label="免押">
          <el-switch v-model="editForm.deposit_waived" @change="onEditDepositWaivedChange" />
        </el-form-item>
        <el-form-item label="押金" v-if="!editForm.deposit_waived">
          <el-input-number v-model="editForm.deposit" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="免押到期" v-if="editForm.deposit_waived">
          <el-date-picker 
            v-model="editForm.deposit_waived_expiry" 
            type="date" 
            placeholder="免押到期日期" 
            value-format="YYYY-MM-DD"
            style="width: 100%" 
          />
        </el-form-item>
        <el-form-item label="服务类型">
          <el-radio-group v-model="editForm.service_type" class="service-radio-group">
            <el-radio-button value="basic">基础</el-radio-button>
            <el-radio-button value="premium">优享</el-radio-button>
            <el-radio-button value="vip">尊享</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="订单来源">
          <el-select v-model="editForm.source_id" placeholder="选择订单来源（可选）" style="width: 100%" clearable>
            <el-option 
              v-for="s in orderSources" 
              :key="s.id" 
              :label="`${s.name} (${s.commission_rate}%服务费)`" 
              :value="s.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="合同号">
          <el-input v-model="editForm.contract_number" placeholder="合同号（选填）" />
        </el-form-item>
        <el-form-item label="取车位置">
          <el-input v-model="editForm.pickup_location" placeholder="取车位置（选填）" />
        </el-form-item>
        <el-form-item label="还车位置">
          <el-input v-model="editForm.return_location" placeholder="还车位置（选填）" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.remarks" type="textarea" :rows="2" placeholder="备注信息" />
        </el-form-item>
        <el-form-item label="预估">
          <span class="estimate">{{ editEstimatedDays }} 天，共 ¥{{ editEstimatedTotal }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleEditSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
    
    <!-- 取车对话框 -->
    <el-dialog v-model="pickupDialogVisible" title="取车确认" width="90%" :style="{ maxWidth: '400px' }">
      <el-form :model="pickupForm" label-width="80px">
        <el-form-item label="取车里程">
          <el-input-number v-model="pickupForm.pickup_mileage" :min="0" placeholder="公里数（选填）" style="width: 100%" />
        </el-form-item>
        <el-form-item label="取车照片">
          <div class="single-upload">
            <div v-if="pickupForm.pickup_image" class="image-preview">
              <img :src="getImageUrl(pickupForm.pickup_image)" @click="previewImage([pickupForm.pickup_image], 0)" />
              <div class="image-remove" @click="pickupForm.pickup_image = ''">×</div>
            </div>
            <div v-else class="upload-btn" @click="triggerPickupUpload">
              <el-icon><Plus /></el-icon>
              <span>上传照片</span>
            </div>
            <input ref="pickupImageInput" type="file" accept="image/*" capture="environment" style="display: none" @change="handlePickupImageUpload" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pickupDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handlePickupConfirm" :loading="submitting">确定取车</el-button>
      </template>
    </el-dialog>
    
    <!-- 还车对话框 -->
    <el-dialog v-model="returnDialogVisible" title="还车确认" width="90%" :style="{ maxWidth: '400px' }">
      <el-form :model="returnForm" label-width="80px">
        <el-form-item label="还车里程">
          <el-input-number v-model="returnForm.return_mileage" :min="0" placeholder="公里数（选填）" style="width: 100%" />
        </el-form-item>
        <el-form-item label="还车照片">
          <div class="single-upload">
            <div v-if="returnForm.return_image" class="image-preview">
              <img :src="getImageUrl(returnForm.return_image)" @click="previewImage([returnForm.return_image], 0)" />
              <div class="image-remove" @click="returnForm.return_image = ''">×</div>
            </div>
            <div v-else class="upload-btn" @click="triggerReturnUpload">
              <el-icon><Plus /></el-icon>
              <span>上传照片</span>
            </div>
            <input ref="returnImageInput" type="file" accept="image/*" capture="environment" style="display: none" @change="handleReturnImageUpload" />
          </div>
        </el-form-item>
        <el-form-item label="还车时间">
          <input 
            type="datetime-local" 
            :value="formatDateTimeLocal(returnForm.actual_end_date)"
            class="native-datetime-input"
            @change="onReturnDateTimeChange"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="returnForm.remarks" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="returnDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleReturn" :loading="submitting">确定还车</el-button>
      </template>
    </el-dialog>
    
    <!-- 续租对话框 -->
    <el-dialog v-model="extendDialogVisible" title="续租" width="90%" :style="{ maxWidth: '400px' }">
      <el-form :model="extendForm" label-width="80px">
        <el-form-item label="当前还车">
          <span>{{ currentOrder?.end_date ? formatDateTime(currentOrder.end_date) : '' }}</span>
        </el-form-item>
        <el-form-item label="新时间">
          <input 
            type="datetime-local" 
            :value="formatDateTimeLocal(extendForm.new_end_date)"
            class="native-datetime-input"
            @change="onExtendDateTimeChange"
          />
        </el-form-item>
        <el-form-item label="续租时长">
          <span>{{ extendDurationText }}</span>
        </el-form-item>
        <el-form-item label="续租金额">
          <el-input-number v-model="extendForm.extend_amount" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="已支付">
          <el-switch v-model="extendForm.has_payment" />
        </el-form-item>
        <template v-if="extendForm.has_payment">
          <el-form-item label="支付金额">
            <el-input-number v-model="extendForm.payment_amount" :min="0" style="width: 100%" />
          </el-form-item>
          <el-form-item label="支付方式">
            <el-select v-model="extendForm.payment_method" placeholder="选择支付方式" style="width: 100%">
              <el-option v-for="item in PAYMENT_METHOD_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="extendDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleExtend" :loading="submitting">确定续租</el-button>
      </template>
    </el-dialog>

    <!-- 支付对话框 -->
    <el-dialog v-model="paymentDialogVisible" title="添加支付" width="90%" :style="{ maxWidth: '400px' }">
      <el-form ref="paymentFormRef" :model="paymentForm" :rules="paymentRules" label-width="70px">
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="paymentForm.amount" :min="0" :precision="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="方式" prop="payment_method">
          <el-select v-model="paymentForm.payment_method" style="width: 100%">
            <el-option v-for="item in PAYMENT_METHOD_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型" prop="payment_type">
          <el-select v-model="paymentForm.payment_type" style="width: 100%">
            <el-option v-for="item in PAYMENT_TYPE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="paymentForm.remarks" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="paymentDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAddPayment" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 图片预览 -->
    <el-dialog v-model="imagePreviewVisible" title="图片预览" width="90%" :style="{ maxWidth: '500px' }">
      <el-carousel :initial-index="previewIndex" indicator-position="outside">
        <el-carousel-item v-for="(img, idx) in previewImagesList" :key="idx">
          <img :src="getImageUrl(img)" style="width: 100%; height: 100%; object-fit: contain" />
        </el-carousel-item>
      </el-carousel>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { orderApi, vehicleApi, blacklistApi, orderSourceApi, uploadApi, customerApi } from '../api'
import { PAYMENT_METHOD_OPTIONS, PAYMENT_TYPE_OPTIONS, SERVICE_TYPE_OPTIONS, ORDER_STATUS_TYPE_MAP } from '../utils/constants'
import { getImageUrl, formatDateTime, formatDateTimeLocal, getOrderStatusType as getStatusType, getServiceLabel, getServiceTagType } from '../utils/helpers'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const editDialogVisible = ref(false)
const pickupDialogVisible = ref(false)
const returnDialogVisible = ref(false)
const extendDialogVisible = ref(false)
const paymentDialogVisible = ref(false)
const formRef = ref<FormInstance>()
const editFormRef = ref<FormInstance>()
const vehicles = ref<any[]>([])
const orderSources = ref<any[]>([])
const regularCustomers = ref<any[]>([])
const selectedRegularCustomer = ref('')
const blacklistWarning = ref('')
const blacklistReason = ref('')
const idCardInput = ref<HTMLInputElement>()
const licenseInput = ref<HTMLInputElement>()
const editIdCardInput = ref<HTMLInputElement>()
const editLicenseInput = ref<HTMLInputElement>()
const pickupImageInput = ref<HTMLInputElement>()
const returnImageInput = ref<HTMLInputElement>()
const imagePreviewVisible = ref(false)
const previewImagesList = ref<string[]>([])
const previewIndex = ref(0)
const currentOrder = ref<any>(null)

// 标签页
const activeTab = ref('pending')
const tabCounts = reactive({
  pending: 0,
  active: 0,
  completed: 0,
  cancelled: 0
})

const searchForm = reactive({ keyword: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

const form = reactive({
  customer_name: '',
  customer_phone: '',
  customer_id_card: '',
  customer_license: '',
  id_card_images: [] as string[],
  license_images: [] as string[],
  vehicle_id: '',
  source_id: '',
  start_date: '',
  end_date: '',
  daily_rate: 0,
  total_amount: 0,
  deposit: 0,
  deposit_waived: false,
  deposit_waived_expiry: '',
  service_type: 'basic',
  contract_number: '',
  pickup_location: '',
  return_location: '',
  remarks: '',
  // 预付相关
  has_prepay: false,
  prepay_amount: 0,
  prepay_method: 'wechat',
  prepay_type: 'rent'
})

const rules: FormRules = {
  customer_name: [{ required: true, message: '请输入客户姓名', trigger: 'blur' }],
  customer_phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  vehicle_id: [{ required: true, message: '请选择车辆', trigger: 'change' }],
  source_id: [{ required: true, message: '请选择订单来源', trigger: 'change' }],
  start_date: [{ required: true, message: '请选择起租日期', trigger: 'change' }],
  end_date: [{ required: true, message: '请选择还车日期', trigger: 'change' }]
}

// 编辑表单
const editForm = reactive({
  customer_name: '',
  customer_phone: '',
  customer_id_card: '',
  id_card_images: [] as string[],
  customer_license: '',
  license_images: [] as string[],
  vehicle_id: '',
  start_date: '',
  end_date: '',
  daily_rate: 0,
  total_amount: 0,
  deposit: 0,
  deposit_waived: false,
  deposit_waived_expiry: '',
  service_type: 'basic',
  source_id: '',
  contract_number: '',
  pickup_location: '',
  return_location: '',
  remarks: ''
})

const editRules: FormRules = {
  customer_name: [{ required: true, message: '请输入客户姓名', trigger: 'blur' }],
  customer_phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  start_date: [{ required: true, message: '请选择起租日期', trigger: 'change' }],
  end_date: [{ required: true, message: '请选择还车日期', trigger: 'change' }]
}

// 还车表单
const returnForm = reactive({
  actual_end_date: '',
  remarks: '',
  return_mileage: undefined as number | undefined,
  return_image: ''
})

// 取车表单
const pickupForm = reactive({
  pickup_mileage: undefined as number | undefined,
  pickup_image: ''
})

// 续租表单
const extendForm = reactive({
  new_end_date: '',
  extend_amount: 0,
  has_payment: false,
  payment_amount: 0,
  payment_method: 'wechat'
})

// 支付表单
const paymentFormRef = ref<FormInstance>()
const paymentForm = reactive({
  amount: 0,
  payment_method: 'cash',
  payment_type: 'rent',
  remarks: ''
})

const paymentRules: FormRules = {
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  payment_method: [{ required: true, message: '请选择支付方式', trigger: 'change' }],
  payment_type: [{ required: true, message: '请选择支付类型', trigger: 'change' }]
}

function previewImage(images: string[], index: number) {
  previewImagesList.value = images
  previewIndex.value = index
  imagePreviewVisible.value = true
}

function triggerUpload(type: 'id_card' | 'license') {
  if (type === 'id_card') {
    idCardInput.value?.click()
  } else {
    licenseInput.value?.click()
  }
}

async function handleUpload(e: Event, type: 'id_card' | 'license') {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    return
  }

  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过10MB')
    return
  }

  try {
    const res = await uploadApi.uploadCustomer(file)
    if (res.success && res.data) {
      if (type === 'id_card') {
        form.id_card_images.push(res.data.url)
      } else {
        form.license_images.push(res.data.url)
      }
      ElMessage.success('上传成功')
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch (error) {
    ElMessage.error('上传失败')
  }

  target.value = ''
}

function removeIdCardImage(index: number) {
  form.id_card_images.splice(index, 1)
}

function removeLicenseImage(index: number) {
  form.license_images.splice(index, 1)
}

// 处理原生日期时间输入
function onStartDateTimeChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.value) {
    // datetime-local 格式: YYYY-MM-DDTHH:mm -> YYYY-MM-DD HH:mm:ss
    form.start_date = target.value.replace('T', ' ') + ':00'
  }
  // 如果已经填写了结束日期，重新加载可用车辆
  if (form.start_date && form.end_date) {
    loadVehicles(form.start_date, form.end_date)
  }
}

function onEndDateTimeChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.value) {
    form.end_date = target.value.replace('T', ' ') + ':00'
  }
  // 如果已经填写了开始日期，重新加载可用车辆
  if (form.start_date && form.end_date) {
    loadVehicles(form.start_date, form.end_date)
  }
}

const estimatedDays = computed(() => {
  if (form.start_date && form.end_date) {
    const start = new Date(form.start_date)
    const end = new Date(form.end_date)
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    return Math.max(1, Math.ceil(hours / 24))
  }
  return 0
})

const estimatedTotal = computed(() => {
  // 如果填了总租金则使用总租金
  if (form.total_amount && form.total_amount > 0) {
    return form.total_amount
  }
  // 否则按日租金计算
  return estimatedDays.value * form.daily_rate
})

const selectedSource = computed(() => {
  return orderSources.value.find(s => s.id === form.source_id)
})

const netAmount = computed(() => {
  if (selectedSource.value) {
    const rate = selectedSource.value.commission_rate || 0
    return Math.round(estimatedTotal.value * (100 - rate) / 100)
  }
  return estimatedTotal.value
})

// 编辑表单预估天数
const editEstimatedDays = computed(() => {
  if (editForm.start_date && editForm.end_date) {
    const start = new Date(editForm.start_date)
    const end = new Date(editForm.end_date)
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    return Math.max(1, Math.ceil(hours / 24))
  }
  return 0
})

// 编辑表单预估总金额
const editEstimatedTotal = computed(() => {
  // 如果填了总租金则使用总租金
  if (editForm.total_amount && editForm.total_amount > 0) {
    return editForm.total_amount
  }
  // 否则按日租金计算
  return editEstimatedDays.value * editForm.daily_rate
})

// 标签页切换
function onTabChange() {
  pagination.page = 1
  loadData()
}

// 加载各状态数量
async function loadTabCounts() {
  try {
    const res: any = await orderApi.getList({ pageSize: 1000 })
    if (res.success) {
      const allOrders = res.data.data || []
      tabCounts.pending = allOrders.filter((o: any) => o.status === 'pending').length
      tabCounts.active = allOrders.filter((o: any) => o.status === 'active').length
      tabCounts.completed = allOrders.filter((o: any) => o.status === 'completed').length
      tabCounts.cancelled = allOrders.filter((o: any) => o.status === 'cancelled').length
    }
  } catch (error) {
    console.error('加载统计失败', error)
  }
}

async function loadData() {
  loading.value = true
  try {
    const res: any = await orderApi.getList({ 
      ...searchForm, 
      status: activeTab.value,
      ...pagination 
    })
    if (res.success) {
      tableData.value = res.data.data
      pagination.total = res.data.total
    }
  } catch (error) {
    console.error('加载数据失败', error)
  } finally {
    loading.value = false
  }
}

async function loadVehicles(startDate?: string, endDate?: string, excludeOrderId?: string) {
  try {
    const params: any = {}
    if (startDate && endDate) {
      params.start_date = startDate
      params.end_date = endDate
    }
    if (excludeOrderId) {
      params.exclude_order_id = excludeOrderId
    }
    const res: any = await vehicleApi.getAvailable(params)
    if (res.success) {
      vehicles.value = res.data
    }
  } catch (error) {
    console.error('加载车辆失败', error)
  }
}

async function loadOrderSources() {
  try {
    const res: any = await orderSourceApi.getList({ pageSize: 100 })
    if (res.success) {
      // 后端返回的是 data 数组，不是 data.data
      orderSources.value = Array.isArray(res.data) ? res.data : (res.data.data || [])
    }
  } catch (error) {
    console.error('加载订单来源失败', error)
  }
}

async function loadRegularCustomers() {
  try {
    const res: any = await customerApi.getRegular()
    if (res.success) {
      regularCustomers.value = res.data || []
    }
  } catch (error) {
    console.error('加载常用客户失败', error)
  }
}

function onRegularCustomerChange(customerId: string) {
  if (customerId) {
    const customer = regularCustomers.value.find(c => c.id === customerId)
    if (customer) {
      form.customer_name = customer.name
      form.customer_phone = customer.phone
      form.customer_id_card = customer.id_card || ''
      form.customer_license = customer.license_number || ''
      // 检查黑名单
      checkBlacklist()
    }
  }
}

function openDialog() {
  // 设置默认日期时间（当前时间）
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const defaultStart = `${year}-${month}-${day} ${hours}:${minutes}:00`
  
  // 默认还车时间为第二天同一时间
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const tYear = tomorrow.getFullYear()
  const tMonth = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const tDay = String(tomorrow.getDate()).padStart(2, '0')
  const defaultEnd = `${tYear}-${tMonth}-${tDay} ${hours}:${minutes}:00`
  
  Object.assign(form, {
    customer_name: '',
    customer_phone: '',
    customer_id_card: '',
    customer_license: '',
    id_card_images: [],
    license_images: [],
    vehicle_id: '',
    source_id: '',
    start_date: defaultStart,
    end_date: defaultEnd,
    daily_rate: 0,
    total_amount: 0,
    deposit: 0,
    deposit_waived: false,
    deposit_waived_expiry: '',
    service_type: 'basic',
    contract_number: '',
    pickup_location: '',
    return_location: '',
    remarks: '',
    has_prepay: false,
    prepay_amount: 0,
    prepay_method: 'wechat',
    prepay_type: 'rent'
  })
  selectedRegularCustomer.value = ''
  blacklistWarning.value = ''
  blacklistReason.value = ''
  // 加载当前时间段可用的车辆
  loadVehicles(defaultStart, defaultEnd)
  loadOrderSources()
  loadRegularCustomers()
  dialogVisible.value = true
}

// 检查黑名单
async function checkBlacklist() {
  if (!form.customer_phone || !/^1[3-9]\d{9}$/.test(form.customer_phone)) {
    blacklistWarning.value = ''
    blacklistReason.value = ''
    return
  }
  
  try {
    const res: any = await blacklistApi.check({ phone: form.customer_phone })
    if (res.success && res.data.isBlacklisted) {
      blacklistWarning.value = `该客户在黑名单中！`
      blacklistReason.value = res.data.record?.reason || '未知'
    } else {
      blacklistWarning.value = ''
      blacklistReason.value = ''
    }
  } catch (error) {
    console.error('检查黑名单失败', error)
  }
}

// 从订单添加到黑名单
async function addToBlacklistFromOrder() {
  try {
    const { value: reason } = await ElMessageBox.prompt('请输入拉黑原因', '添加到黑名单', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValue: '其他问题',
      inputValidator: (val) => !!val || '请输入拉黑原因'
    })
    
    const res: any = await blacklistApi.add({
      name: form.customer_name,
      phone: form.customer_phone,
      id_card: form.customer_id_card,
      reason
    })
    
    if (res.success) {
      ElMessage.success('已添加到黑名单')
      blacklistWarning.value = ''
    }
  } catch (error) {
    // 取消
  }
}

function onVehicleChange(id: string) {
  const vehicle = vehicles.value.find(v => v.id === id)
  if (vehicle) {
    form.daily_rate = vehicle.daily_rate || 0
    form.deposit = vehicle.deposit || 0
  }
}

// 免押状态变更
function onDepositWaivedChange(waived: boolean) {
  if (waived) {
    // 勾选免押时，计算免押到期日期（还车后30天）
    if (form.end_date) {
      const endDate = new Date(form.end_date)
      endDate.setDate(endDate.getDate() + 30)
      form.deposit_waived_expiry = endDate.toISOString().slice(0, 10)
    }
    form.deposit = 0
  } else {
    form.deposit_waived_expiry = ''
  }
}

function onSourceChange() {
  // 来源变化时自动重新计算到账金额
}

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    const res: any = await orderApi.create(form)
    if (res.success) {
      ElMessage.success('订单创建成功')
      dialogVisible.value = false
      loadData()
      loadTabCounts()
    }
  } catch (error) {
    console.error('创建失败', error)
  } finally {
    submitting.value = false
  }
}

function handleRowClick(row: any) {
  // 保存当前标签页状态
  sessionStorage.setItem('orderListTab', activeTab.value)
  router.push(`/orders/${row.id}`)
}

// 跳转到订单详情
function goToDetail(item: any) {
  // 保存当前标签页状态
  sessionStorage.setItem('orderListTab', activeTab.value)
  router.push(`/orders/${item.id}`)
}

// 从订单列表拉黑客户
async function handleAddToBlacklist(row: any) {
  try {
    const { value: reason } = await ElMessageBox.prompt('请输入拉黑原因', '添加到黑名单', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入拉黑原因',
      inputValidator: (val) => !!val?.trim() || '请输入拉黑原因'
    })
    
    const res: any = await blacklistApi.add({
      name: row.customer_name,
      phone: row.customer_phone,
      id_card: row.customer_id_card,
      reason: reason.trim()
    })
    
    if (res.success) {
      ElMessage.success('已添加到黑名单')
    }
  } catch (error) {
    // 取消
  }
}

// 打开编辑对话框
async function openEditDialog(row: any) {
  currentOrder.value = row
  await loadOrderSources()
  // 加载当前时间段可用的车辆（排除当前订单）
  await loadVehicles(row.start_date, row.end_date, row.id)
  
  // 获取订单详情以获取完整信息
  const detailRes: any = await orderApi.getOne(row.id)
  const detail = detailRes.success ? detailRes.data : row
  
  Object.assign(editForm, {
    customer_name: detail.customer_name,
    customer_phone: detail.customer_phone,
    customer_id_card: detail.customer_id_card || detail.id_card || '',
    id_card_images: detail.id_card_images || [],
    customer_license: detail.customer_license || detail.license_number || '',
    license_images: detail.license_images || [],
    vehicle_id: detail.vehicle_id,
    start_date: detail.start_date,
    end_date: detail.end_date,
    daily_rate: detail.daily_rate || 0,
    total_amount: detail.total_amount || 0,
    deposit: detail.deposit || 0,
    deposit_waived: detail.deposit_waived === 1,
    deposit_waived_expiry: detail.deposit_waived_expiry || '',
    service_type: detail.service_type || 'basic',
    source_id: detail.source_id || '',
    contract_number: detail.contract_number || '',
    pickup_location: detail.pickup_location || '',
    return_location: detail.return_location || '',
    remarks: detail.remarks || ''
  })
  editDialogVisible.value = true
}

// 编辑表单日期时间变化
function onEditStartDateTimeChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.value) {
    editForm.start_date = target.value.replace('T', ' ') + ':00'
  }
  // 如果已经填写了结束日期，重新加载可用车辆
  if (editForm.start_date && editForm.end_date) {
    loadVehicles(editForm.start_date, editForm.end_date, currentOrder.value?.id)
  }
}

function onEditEndDateTimeChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.value) {
    editForm.end_date = target.value.replace('T', ' ') + ':00'
  }
  // 如果已经填写了开始日期，重新加载可用车辆
  if (editForm.start_date && editForm.end_date) {
    loadVehicles(editForm.start_date, editForm.end_date, currentOrder.value?.id)
  }
}

// 编辑表单免押状态变更
function onEditDepositWaivedChange(waived: boolean) {
  if (waived) {
    if (editForm.end_date) {
      const endDate = new Date(editForm.end_date)
      endDate.setDate(endDate.getDate() + 30)
      editForm.deposit_waived_expiry = endDate.toISOString().slice(0, 10)
    }
    editForm.deposit = 0
  } else {
    editForm.deposit_waived_expiry = ''
  }
}

// 提交编辑
async function handleEditSubmit() {
  const valid = await editFormRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    const res: any = await orderApi.update(currentOrder.value.id, editForm)
    if (res.success) {
      ElMessage.success('订单修改成功')
      editDialogVisible.value = false
      loadData()
    }
  } catch (error) {
    console.error('修改失败', error)
  } finally {
    submitting.value = false
  }
}

// 打开取车对话框
function openPickupDialog(row: any) {
  currentOrder.value = row
  pickupForm.pickup_mileage = undefined
  pickupForm.pickup_image = ''
  pickupDialogVisible.value = true
}

// 取车图片上传
function triggerPickupUpload() {
  pickupImageInput.value?.click()
}

async function handlePickupImageUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过10MB')
    return
  }
  try {
    const res = await uploadApi.uploadOther(file)
    if (res.success && res.data) {
      pickupForm.pickup_image = res.data.url
      ElMessage.success('上传成功')
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch (error) {
    ElMessage.error('上传失败')
  }
  target.value = ''
}

// 确认取车
async function handlePickupConfirm() {
  submitting.value = true
  try {
    const res: any = await orderApi.updateStatus(currentOrder.value.id, {
      status: 'active',
      pickup_mileage: pickupForm.pickup_mileage,
      pickup_image: pickupForm.pickup_image || undefined
    })
    if (res.success) {
      ElMessage.success('取车成功')
      pickupDialogVisible.value = false
      loadData()
      loadTabCounts()
    }
  } catch (error) {
    console.error('取车失败', error)
  } finally {
    submitting.value = false
  }
}

// 打开还车对话框
function openReturnDialog(row: any) {
  currentOrder.value = row
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  returnForm.actual_end_date = `${year}-${month}-${day} ${hours}:${minutes}:00`
  returnForm.remarks = ''
  returnForm.return_mileage = undefined
  returnForm.return_image = ''
  // 如果有取车里程，显示提示
  if (row.pickup_mileage) {
    returnForm.return_mileage = row.pickup_mileage
  }
  returnDialogVisible.value = true
}

// 还车图片上传
function triggerReturnUpload() {
  returnImageInput.value?.click()
}

async function handleReturnImageUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过10MB')
    return
  }
  try {
    const res = await uploadApi.uploadOther(file)
    if (res.success && res.data) {
      returnForm.return_image = res.data.url
      ElMessage.success('上传成功')
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch (error) {
    ElMessage.error('上传失败')
  }
  target.value = ''
}

// 还车日期时间变化
function onReturnDateTimeChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.value) {
    returnForm.actual_end_date = target.value.replace('T', ' ') + ':00'
  }
}

// 确认还车
async function handleReturn() {
  submitting.value = true
  try {
    const res: any = await orderApi.updateStatus(currentOrder.value.id, {
      status: 'completed',
      actual_end_date: returnForm.actual_end_date,
      remarks: returnForm.remarks || undefined,
      return_mileage: returnForm.return_mileage,
      return_image: returnForm.return_image || undefined
    })
    if (res.success) {
      ElMessage.success('还车成功')
      returnDialogVisible.value = false
      loadData()
      loadTabCounts()
    }
  } catch (error) {
    console.error('还车失败', error)
  } finally {
    submitting.value = false
  }
}

// 打开续租对话框
function openExtendDialog(row: any) {
  currentOrder.value = row
  // 默认新还车时间为当前还车时间加1天
  if (row.end_date) {
    const date = new Date(row.end_date)
    date.setDate(date.getDate() + 1)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    extendForm.new_end_date = `${year}-${month}-${day} ${hours}:${minutes}:00`
  }
  // 默认续租金额为日租金
  extendForm.extend_amount = row.daily_rate || 0
  // 重置支付字段
  extendForm.has_payment = false
  extendForm.payment_amount = 0
  extendForm.payment_method = 'wechat'
  extendDialogVisible.value = true
}

// 续租日期时间变化
function onExtendDateTimeChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.value) {
    extendForm.new_end_date = target.value.replace('T', ' ') + ':00'
  }
}

// 续租时长计算（小时数）
const extendHours = computed(() => {
  if (currentOrder.value?.end_date && extendForm.new_end_date) {
    const oldEnd = new Date(currentOrder.value.end_date)
    const newEnd = new Date(extendForm.new_end_date)
    return Math.max(0, Math.ceil((newEnd.getTime() - oldEnd.getTime()) / (1000 * 60 * 60)))
  }
  return 0
})

// 续租时长文本（几天几小时）
const extendDurationText = computed(() => {
  const totalHours = extendHours.value
  if (totalHours <= 0) return '0小时'
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  if (days > 0 && hours > 0) {
    return `${days}天${hours}小时`
  } else if (days > 0) {
    return `${days}天`
  } else {
    return `${hours}小时`
  }
})

// 确认续租
async function handleExtend() {
  if (!extendForm.new_end_date) {
    ElMessage.warning('请选择新的还车时间')
    return
  }
  submitting.value = true
  try {
    const res: any = await orderApi.extend(currentOrder.value.id, {
      new_end_date: extendForm.new_end_date,
      extend_amount: extendForm.extend_amount,
      has_payment: extendForm.has_payment,
      payment_amount: extendForm.has_payment ? extendForm.payment_amount : undefined,
      payment_method: extendForm.has_payment ? extendForm.payment_method : undefined
    })
    if (res.success) {
      ElMessage.success(`续租成功，续租金额 ¥${res.data.extend_amount}`)
      extendDialogVisible.value = false
      loadData()
    }
  } catch (error) {
    console.error('续租失败', error)
  } finally {
    submitting.value = false
  }
}

// 打开支付对话框
function openPaymentDialog(row: any) {
  currentOrder.value = row
  paymentForm.amount = 0
  paymentForm.payment_method = 'cash'
  paymentForm.payment_type = 'rent'
  paymentForm.remarks = ''
  paymentDialogVisible.value = true
}

// 添加支付
async function handleAddPayment() {
  const valid = await paymentFormRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    const res: any = await orderApi.addPayment(currentOrder.value.id, {
      amount: paymentForm.amount,
      payment_method: paymentForm.payment_method,
      payment_type: paymentForm.payment_type,
      remarks: paymentForm.remarks
    })
    if (res.success) {
      ElMessage.success('支付添加成功')
      paymentDialogVisible.value = false
      loadData()
    }
  } catch (error) {
    console.error('添加支付失败', error)
  } finally {
    submitting.value = false
  }
}

// 取消订单
async function handleCancel(row: any) {
  try {
    await ElMessageBox.confirm('确定要取消该订单吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const res: any = await orderApi.cancel(row.id)
    if (res.success) {
      ElMessage.success('订单已取消')
      loadData()
      loadTabCounts()
    }
  } catch (error) {
    // 取消
  }
}

onMounted(() => {
  // 检查是否从客户管理跳转过来查看订单
  if (route.query.customer_id) {
    searchForm.keyword = route.query.customer_name as string || ''
  }
  // 从 sessionStorage 恢复之前的标签页状态
  const savedTab = sessionStorage.getItem('orderListTab')
  if (savedTab && ['pending', 'active', 'completed', 'cancelled'].includes(savedTab)) {
    activeTab.value = savedTab
  }
  loadData()
  loadTabCounts()
})
</script>

<style scoped>
.page-container {
  max-width: 1200px;
  margin: 0 auto;
}

.order-tabs {
  margin-bottom: 12px;
}

.order-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.order-tabs :deep(.el-badge__content) {
  transform: scale(0.8);
}

.search-card {
  margin-bottom: 12px;
}

.search-card :deep(.el-form-item) {
  margin-bottom: 8px;
}

@media (min-width: 768px) {
  .search-card {
    margin-bottom: 16px;
  }
  
  .search-card :deep(.el-form-item) {
    margin-bottom: 0;
  }
}

.action-bar {
  margin-bottom: 12px;
}

.mobile-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.mobile-card {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  cursor: pointer;
}

.mobile-card:active {
  background: #f5f5f5;
}

.mobile-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.order-no {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.mobile-card-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}

.mobile-card-row .label {
  color: #909399;
}

.mobile-card-row .value {
  color: #303133;
}

.mobile-card-row a {
  color: #409EFF;
  text-decoration: none;
  margin-left: 8px;
}

.mobile-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
  font-size: 14px;
}

.mobile-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.amount {
  font-weight: 600;
  color: #303133;
}

.paid {
  color: #67C23A;
}

.text-warning {
  color: #E6A23C;
}

.text-muted {
  color: #909399;
}

.estimate {
  font-weight: 500;
  color: #409EFF;
}

.net-amount {
  font-weight: 500;
  color: #67C23A;
  margin-left: 8px;
}

.hide-mobile {
  display: none;
}

.table-card {
  display: none;
}

@media (min-width: 768px) {
  .mobile-cards {
    display: none;
  }
  
  .table-card {
    display: block;
  }
  
  .hide-mobile {
    display: table;
  }
  
  :deep(.el-table__row) {
    cursor: pointer;
  }
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

:deep(.el-divider__text) {
  font-size: 13px;
  color: #909399;
  padding: 0 10px;
}

/* 迷你上传组件 */
.mini-upload {
  width: 100%;
}

.mini-upload .image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mini-upload .image-item {
  position: relative;
  width: 50px;
  height: 50px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #dcdfe6;
}

.mini-upload .image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}

.mini-upload .image-remove {
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
}

.mini-upload .upload-btn {
  width: 50px;
  height: 50px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #909399;
}

.mini-upload .upload-btn:hover {
  border-color: #409EFF;
  color: #409EFF;
}

/* 原生日期时间输入框样式 */
.native-datetime-input {
  width: 100%;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  color: #606266;
  background: #fff;
  outline: none;
  transition: border-color 0.2s;
  -webkit-appearance: none;
}

.native-datetime-input:focus {
  border-color: #409EFF;
}

.native-datetime-input::-webkit-datetime-edit {
  padding: 0;
}

.native-datetime-input::-webkit-calendar-picker-indicator {
  width: 20px;
  height: 20px;
  cursor: pointer;
  opacity: 0.6;
}

.native-datetime-input::-webkit-calendar-picker-indicator:hover {
  opacity: 1;
}

/* 服务类型单选按钮 */
.service-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.service-radio-group :deep(.el-radio-button__inner) {
  padding: 8px 12px;
}

/* 单图上传 */
.single-upload {
  width: 100%;
}

.single-upload .image-preview {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #dcdfe6;
}

.single-upload .image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}

.single-upload .image-remove {
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 20px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
}

.single-upload .upload-btn {
  width: 80px;
  height: 80px;
  border: 2px dashed #dcdfe6;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #909399;
  font-size: 12px;
}

.single-upload .upload-btn:hover {
  border-color: #409EFF;
  color: #409EFF;
}

.single-upload .upload-btn .el-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

/* 来源标签 */
.source-tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: #fff;
  margin-left: 6px;
  vertical-align: middle;
}
</style>