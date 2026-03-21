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
      <div v-for="item in tableData" :key="item.id" class="mobile-card" @click="$router.push(`/orders/${item.id}`)">
        <div class="mobile-card-header">
          <span class="order-no">{{ item.order_no }}</span>
          <el-tag :type="getStatusType(item.status)" size="small">{{ item.status_text }}</el-tag>
        </div>
        <div class="mobile-card-row">
          <span class="label">客户</span>
          <span class="value">{{ item.customer_name }} <a :href="'tel:' + item.customer_phone">{{ item.customer_phone }}</a></span>
        </div>
        <div class="mobile-card-row">
          <span class="label">车辆</span>
          <span class="value">{{ item.plate_number }} | {{ item.brand }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">取车</span>
          <span class="value">{{ formatDateTime(item.start_date) }}</span>
        </div>
        <div class="mobile-card-row">
          <span class="label">还车</span>
          <span class="value">{{ formatDateTime(item.end_date) }}</span>
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
            <el-button type="danger" size="small" @click="handleCancel(item)">取消</el-button>
          </template>
          <template v-else-if="item.status === 'active'">
            <el-button type="primary" size="small" @click="openEditDialog(item)">编辑</el-button>
            <el-button type="success" size="small" @click="openReturnDialog(item)">还车</el-button>
            <el-button type="warning" size="small" @click="openExtendDialog(item)">续租</el-button>
            <el-button type="danger" size="small" @click="handleCancel(item)">取消</el-button>
          </template>
          <el-button v-else disabled size="small">已结束</el-button>
        </div>
      </div>
    </div>

    <!-- PC端表格 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="tableData" v-loading="loading" stripe class="hide-mobile" @row-click="handleRowClick">
        <el-table-column prop="order_no" label="订单号" width="140" />
        <el-table-column prop="customer_name" label="客户" width="80" />
        <el-table-column prop="customer_phone" label="电话" width="110" />
        <el-table-column prop="plate_number" label="车牌" width="80" />
        <el-table-column prop="start_date" label="取车" width="130">
          <template #default="{ row }">{{ formatDateTime(row.start_date) }}</template>
        </el-table-column>
        <el-table-column prop="end_date" label="还车" width="130">
          <template #default="{ row }">{{ formatDateTime(row.end_date) }}</template>
        </el-table-column>
        <el-table-column prop="total_amount" label="总金额" width="90">
          <template #default="{ row }">¥{{ row.total_amount }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ row.status_text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="280">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button type="primary" link size="small" @click.stop="openEditDialog(row)">编辑</el-button>
              <el-button type="success" link size="small" @click.stop="openPickupDialog(row)">取车</el-button>
              <el-button type="danger" link size="small" @click.stop="handleCancel(row)">取消</el-button>
            </template>
            <template v-else-if="row.status === 'active'">
              <el-button type="primary" link size="small" @click.stop="openEditDialog(row)">编辑</el-button>
              <el-button type="success" link size="small" @click.stop="openReturnDialog(row)">还车</el-button>
              <el-button type="warning" link size="small" @click.stop="openExtendDialog(row)">续租</el-button>
              <el-button type="danger" link size="small" @click.stop="handleCancel(row)">取消</el-button>
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
            <el-radio-button value="basic">基础服务</el-radio-button>
            <el-radio-button value="premium">优享服务</el-radio-button>
            <el-radio-button value="vip">尊享服务</el-radio-button>
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
            <el-radio-button value="basic">基础服务</el-radio-button>
            <el-radio-button value="premium">优享服务</el-radio-button>
            <el-radio-button value="vip">尊享服务</el-radio-button>
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
        <el-form-item label="备注">
          <el-input v-model="editForm.remarks" type="textarea" :rows="2" placeholder="备注信息" />
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
      <el-form :model="extendForm" label-width="70px">
        <el-form-item label="当前还车">
          <span>{{ currentOrder?.end_date ? formatDateTime(currentOrder.end_date) : '' }}</span>
        </el-form-item>
        <el-form-item label="续租天数">
          <el-input-number v-model="extendForm.extend_days" :min="1" :max="90" style="width: 100%" />
        </el-form-item>
        <el-form-item label="日租金">
          <el-input-number v-model="extendForm.daily_rate" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="续租金额">
          <span class="text-primary">¥{{ extendAmount }}</span>
        </el-form-item>
        <el-form-item label="新还车日">
          <span>{{ newEndDate }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="extendDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleExtend" :loading="submitting">确定续租</el-button>
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
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { orderApi, vehicleApi, blacklistApi, orderSourceApi, uploadApi, customerApi } from '../api'

const router = useRouter()
const loading = ref(false)
const submitting = ref(false)
const tableData = ref<any[]>([])
const dialogVisible = ref(false)
const editDialogVisible = ref(false)
const pickupDialogVisible = ref(false)
const returnDialogVisible = ref(false)
const extendDialogVisible = ref(false)
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
  remarks: ''
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
  start_date: '',
  end_date: '',
  daily_rate: 0,
  total_amount: 0,
  deposit: 0,
  deposit_waived: false,
  deposit_waived_expiry: '',
  service_type: 'basic',
  source_id: '',
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
  extend_days: 1,
  daily_rate: 200
})

const statusTypeMap: Record<string, string> = {
  pending: 'warning',
  active: 'primary',
  completed: 'success',
  cancelled: 'info',
  overdue: 'danger'
}

function getStatusType(status: string) {
  return statusTypeMap[status] || 'info'
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

function getImageUrl(url: string) {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('data:')) return url
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'
  return baseUrl + url
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
}

function onEndDateTimeChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.value) {
    form.end_date = target.value.replace('T', ' ') + ':00'
  }
}

// 格式化日期时间供原生输入框显示
function formatDateTimeLocal(dateStr: string) {
  if (!dateStr) return ''
  // YYYY-MM-DD HH:mm:ss -> YYYY-MM-DDTHH:mm
  return dateStr.replace(' ', 'T').slice(0, 16)
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

async function loadVehicles() {
  try {
    const res: any = await vehicleApi.getAvailable()
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
  Object.assign(form, {
    customer_name: '',
    customer_phone: '',
    customer_id_card: '',
    customer_license: '',
    id_card_images: [],
    license_images: [],
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
    remarks: ''
  })
  selectedRegularCustomer.value = ''
  blacklistWarning.value = ''
  blacklistReason.value = ''
  loadVehicles()
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

// 服务类型标签颜色
function getServiceTagType(type: string) {
  const typeMap: Record<string, string> = {
    basic: '',
    premium: 'warning',
    vip: 'danger'
  }
  return typeMap[type] || ''
}

// 服务类型标签文字
function getServiceLabel(type: string) {
  const labelMap: Record<string, string> = {
    basic: '基础服务',
    premium: '优享服务',
    vip: '尊享服务'
  }
  return labelMap[type] || type
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
  router.push(`/orders/${row.id}`)
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
  Object.assign(editForm, {
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    customer_id_card: row.customer_id_card || '',
    start_date: row.start_date,
    end_date: row.end_date,
    daily_rate: row.daily_rate || 0,
    total_amount: row.total_amount || 0,
    deposit: row.deposit || 0,
    deposit_waived: row.deposit_waived === 1,
    deposit_waived_expiry: row.deposit_waived_expiry || '',
    service_type: row.service_type || 'basic',
    source_id: row.source_id || '',
    remarks: row.remarks || ''
  })
  editDialogVisible.value = true
}

// 编辑表单日期时间变化
function onEditStartDateTimeChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.value) {
    editForm.start_date = target.value.replace('T', ' ') + ':00'
  }
}

function onEditEndDateTimeChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.value) {
    editForm.end_date = target.value.replace('T', ' ') + ':00'
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
  extendForm.extend_days = 1
  extendForm.daily_rate = row.daily_rate || 200
  extendDialogVisible.value = true
}

// 续租金额计算
const extendAmount = computed(() => {
  return extendForm.extend_days * extendForm.daily_rate
})

// 新还车日期计算
const newEndDate = computed(() => {
  if (currentOrder.value?.end_date) {
    const date = new Date(currentOrder.value.end_date)
    date.setDate(date.getDate() + extendForm.extend_days)
    return date.toISOString().slice(0, 10)
  }
  return ''
})

// 确认续租
async function handleExtend() {
  submitting.value = true
  try {
    const res: any = await orderApi.extend(currentOrder.value.id, {
      extend_days: extendForm.extend_days,
      daily_rate: extendForm.daily_rate
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
</style>