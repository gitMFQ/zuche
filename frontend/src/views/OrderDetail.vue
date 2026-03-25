<template>
  <div class="page-container" v-loading="loading">
    <el-page-header @back="goBack" title="返回" class="page-header">
      <template #content>
        <span class="order-title">订单详情</span>
      </template>
      <template #extra>
        <el-tag :type="getStatusType(order.status)" size="small">{{ order.status_text }}</el-tag>
      </template>
    </el-page-header>

    <div v-if="order.id" class="order-content">
      <!-- 订单信息 -->
      <el-card shadow="never" class="info-card">
        <template #header>
          <span class="section-title">订单信息</span>
        </template>
        
        <!-- 移动端信息列表 -->
        <div class="info-list">
          <div class="info-row">
            <span class="label">订单号</span>
            <span class="value">{{ order.order_no }}</span>
          </div>
          <div class="info-row" v-if="order.contract_number">
            <span class="label">合同号</span>
            <span class="value">{{ order.contract_number }}</span>
          </div>
          <div class="info-row">
            <span class="label">客户</span>
            <span class="value">{{ order.customer_name }}</span>
          </div>
          <div class="info-row">
            <span class="label">电话</span>
            <span class="value"><a :href="'tel:' + order.customer_phone">{{ order.customer_phone }}</a></span>
          </div>
          <div class="info-row" v-if="order.id_card">
            <span class="label">身份证</span>
            <span class="value">{{ order.id_card }}</span>
          </div>
          <div class="info-row">
            <span class="label">车辆</span>
            <span class="value">
              <span class="plate-number" :class="order.is_new_energy ? 'new-energy' : 'fuel'">{{ order.plate_number }}</span>
              | {{ order.brand }} {{ order.model }}
            </span>
          </div>
          <div class="info-row">
            <span class="label">取车时间</span>
            <span class="value">{{ formatDateTime(order.start_date) }}</span>
          </div>
          <div class="info-row">
            <span class="label">取车地点</span>
            <span class="value">{{ order.pickup_location || '-' }}</span>
          </div>
          <div class="info-row">
            <span class="label">还车时间</span>
            <span class="value">{{ formatDateTime(order.end_date) }}</span>
          </div>
          <div class="info-row">
            <span class="label">还车地点</span>
            <span class="value">{{ order.return_location || '-' }}</span>
          </div>
          <div class="info-row" v-if="order.pickup_mileage">
            <span class="label">取车里程</span>
            <span class="value">{{ order.pickup_mileage }} km</span>
          </div>
          <div class="info-row" v-if="order.return_mileage">
            <span class="label">还车里程</span>
            <span class="value">{{ order.return_mileage }} km</span>
          </div>
          <div class="info-row">
            <span class="label">日租金</span>
            <span class="value">¥{{ order.daily_rate }}</span>
          </div>
          <div class="info-row">
            <span class="label">总金额</span>
            <span class="value text-primary">¥{{ order.total_amount }}</span>
          </div>
          <div class="info-row">
            <span class="label">押金</span>
            <span class="value">
              <template v-if="order.deposit_waived">
                <el-tag type="success" size="small">免押</el-tag>
                <span v-if="order.deposit_waived_expiry" class="deposit-expiry">至 {{ order.deposit_waived_expiry }}</span>
              </template>
              <template v-else>¥{{ order.deposit || 0 }}</template>
            </span>
          </div>
          <div class="info-row">
            <span class="label">服务类型</span>
            <span class="value">
              <el-tag :type="getServiceTagType(order.service_type)" size="small">{{ getServiceLabel(order.service_type) }}</el-tag>
            </span>
          </div>
          <div class="info-row" v-if="order.source_name">
            <span class="label">订单来源</span>
            <span class="value">
              <span class="source-tag" :style="{ background: order.source_color || '#409EFF' }">{{ order.source_name }}</span>
            </span>
          </div>
          <div class="info-row" v-if="order.commission_rate > 0">
            <span class="label">服务费</span>
            <span class="value">{{ order.commission_rate }}%</span>
          </div>
          <div class="info-row" v-if="order.net_amount">
            <span class="label">到账金额</span>
            <span class="value text-success">¥{{ order.net_amount }}</span>
          </div>
          <div class="info-row">
            <span class="label">已付金额</span>
            <span class="value" :class="unpaidAmount > 0 ? 'text-warning' : 'text-success'">¥{{ order.paid_amount }}</span>
          </div>
          <div class="info-row" v-if="unpaidAmount > 0">
            <span class="label">待付金额</span>
            <span class="value text-danger">¥{{ unpaidAmount }}</span>
          </div>
          <div class="info-row" v-if="order.remarks">
            <span class="label">备注</span>
            <span class="value">{{ order.remarks }}</span>
          </div>
          <div class="info-row">
            <span class="label">创建时间</span>
            <span class="value">{{ formatDateTime(order.created_at) }}</span>
          </div>
          <div class="info-row" v-if="order.updated_at && order.updated_at !== order.created_at">
            <span class="label">更新时间</span>
            <span class="value">{{ formatDateTime(order.updated_at) }}</span>
          </div>
        </div>
        
        <!-- 取车/还车照片 -->
        <div v-if="order.pickup_image || order.return_image" class="order-images">
          <div v-if="order.pickup_image" class="image-section">
            <span class="image-label">取车照片</span>
            <img :src="getImageUrl(order.pickup_image)" class="order-image" @click="previewImage([order.pickup_image], 0)" />
          </div>
          <div v-if="order.return_image" class="image-section">
            <span class="image-label">还车照片</span>
            <img :src="getImageUrl(order.return_image)" class="order-image" @click="previewImage([order.return_image], 0)" />
          </div>
        </div>
      </el-card>

      <!-- 支付记录 -->
      <el-card shadow="never" class="info-card">
        <template #header>
          <div class="card-header-row">
            <span class="section-title">支付记录</span>
            <el-button
              v-if="['pending', 'active', 'completed'].includes(order.status)"
              type="primary"
              size="small"
              @click="paymentDialogVisible = true"
            >添加</el-button>
          </div>
        </template>
        
        <div v-if="order.payments?.length" class="payment-list">
          <div v-for="p in order.payments" :key="p.id" class="payment-item">
            <div class="payment-row">
              <span class="payment-type">{{ getPaymentTypeText(p.payment_type) }}</span>
              <span class="payment-amount">¥{{ p.amount }}</span>
            </div>
            <div class="payment-row">
              <span class="payment-method">{{ getPaymentMethodText(p.payment_method) }}</span>
              <span class="payment-time">{{ formatDateTime(p.created_at) }}</span>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无支付记录" :image-size="60" />
      </el-card>

      <!-- 操作按钮 -->
      <el-card shadow="never" class="info-card">
        <div class="action-buttons">
          <template v-if="order.status === 'pending'">
            <el-button type="primary" plain block @click="openEditDialog">编辑订单</el-button>
            <el-button type="success" block @click="pickupDialogVisible = true">已取车</el-button>
            <el-button type="danger" block @click="handleCancel">取消订单</el-button>
          </template>
          <template v-else-if="order.status === 'active'">
            <el-button type="primary" plain block @click="openEditDialog">编辑订单</el-button>
            <el-button type="warning" block @click="openExtendDialog">续租</el-button>
            <el-button type="success" block @click="completeDialogVisible = true">已还车</el-button>
            <el-button type="danger" block @click="handleCancel">取消订单</el-button>
          </template>
          <el-button v-else disabled block>订单已结束</el-button>
          <el-button type="danger" plain block @click="handleAddToBlacklist">拉黑客户</el-button>
        </div>
      </el-card>
    </div>

    <!-- 添加支付对话框 -->
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
        <el-button type="primary" @click="handlePickup" :loading="submitting">确定取车</el-button>
      </template>
    </el-dialog>

    <!-- 完成订单对话框 -->
    <el-dialog v-model="completeDialogVisible" title="完成订单" width="90%" :style="{ maxWidth: '400px' }">
      <el-form ref="completeFormRef" :model="completeForm" label-width="100px">
        <el-form-item label="还车里程">
          <el-input-number v-model="completeForm.return_mileage" :min="0" placeholder="公里数（选填）" style="width: 100%" />
        </el-form-item>
        <el-form-item label="还车照片">
          <div class="single-upload">
            <div v-if="completeForm.return_image" class="image-preview">
              <img :src="getImageUrl(completeForm.return_image)" @click="previewImage([completeForm.return_image], 0)" />
              <div class="image-remove" @click="completeForm.return_image = ''">×</div>
            </div>
            <div v-else class="upload-btn" @click="triggerReturnUpload">
              <el-icon><Plus /></el-icon>
              <span>上传照片</span>
            </div>
            <input ref="returnImageInput" type="file" accept="image/*" capture="environment" style="display: none" @change="handleReturnImageUpload" />
          </div>
        </el-form-item>
        <el-form-item label="实际还车时间">
          <input 
            type="datetime-local" 
            :value="formatDateTimeLocal(completeForm.actual_end_date)"
            class="native-datetime-input"
            @change="onCompleteDateTimeChange"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="completeForm.remarks" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="completeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleComplete" :loading="submitting">确定完成</el-button>
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
            :disabled="order.status === 'active'"
            @change="onVehicleChange"
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
        <el-form-item label="取车地点">
          <el-input v-model="editForm.pickup_location" placeholder="取车地点（选填）" />
        </el-form-item>
        <el-form-item label="还车" prop="end_date">
          <input 
            type="datetime-local" 
            :value="formatDateTimeLocal(editForm.end_date)"
            class="native-datetime-input"
            @change="onEditEndDateTimeChange"
          />
        </el-form-item>
        <el-form-item label="还车地点">
          <el-input v-model="editForm.return_location" placeholder="还车地点（选填）" />
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

    <!-- 续租对话框 -->
    <el-dialog v-model="extendDialogVisible" title="续租" width="90%" :style="{ maxWidth: '400px' }">
      <el-form :model="extendForm" label-width="80px">
        <el-form-item label="当前还车">
          <span>{{ formatDateTime(order.end_date) }}</span>
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
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { orderApi, blacklistApi, vehicleApi, orderSourceApi, uploadApi } from '../api'
import { PAYMENT_METHOD_OPTIONS, PAYMENT_TYPE_OPTIONS, SERVICE_TYPE_OPTIONS, ORDER_STATUS_TYPE_MAP } from '../utils/constants'
import { getImageUrl, formatDateTime, formatDateTimeLocal, getOrderStatusType as getStatusType, getPaymentMethodText, getPaymentTypeText, getServiceLabel, getServiceTagType } from '../utils/helpers'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const submitting = ref(false)
const order = ref<any>({})
const paymentDialogVisible = ref(false)
const completeDialogVisible = ref(false)
const pickupDialogVisible = ref(false)
const editDialogVisible = ref(false)
const extendDialogVisible = ref(false)
const paymentFormRef = ref<FormInstance>()
const editFormRef = ref<FormInstance>()
const editIdCardInput = ref<HTMLInputElement>()
const editLicenseInput = ref<HTMLInputElement>()
const returnImageInput = ref<HTMLInputElement>()
const pickupImageInput = ref<HTMLInputElement>()
const imagePreviewVisible = ref(false)
const previewImagesList = ref<string[]>([])
const previewIndex = ref(0)
const vehicles = ref<any[]>([])
const orderSources = ref<any[]>([])

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

const completeForm = reactive({
  actual_end_date: '',
  remarks: '',
  return_mileage: undefined as number | undefined,
  return_image: ''
})

const pickupForm = reactive({
  pickup_mileage: undefined as number | undefined,
  pickup_image: ''
})

const editForm = reactive({
  customer_name: '',
  customer_phone: '',
  customer_id_card: '',
  customer_license: '',
  id_card_images: [] as string[],
  license_images: [] as string[],
  vehicle_id: '',
  source_id: '',
  start_date: '',
  pickup_location: '',
  end_date: '',
  return_location: '',
  daily_rate: 0,
  total_amount: 0,
  deposit: 0,
  deposit_waived: false,
  deposit_waived_expiry: '',
  service_type: 'basic',
  contract_number: '',
  remarks: ''
})

const editRules: FormRules = {
  customer_name: [{ required: true, message: '请输入客户姓名', trigger: 'blur' }],
  customer_phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  vehicle_id: [{ required: true, message: '请选择车辆', trigger: 'change' }],
  start_date: [{ required: true, message: '请选择起租日期', trigger: 'change' }],
  end_date: [{ required: true, message: '请选择还车日期', trigger: 'change' }]
}

const extendForm = reactive({
  new_end_date: '',
  extend_amount: 0,
  has_payment: false,
  payment_amount: 0,
  payment_method: 'wechat'
})

function previewImage(images: string[], index: number) {
  previewImagesList.value = images
  previewIndex.value = index
  imagePreviewVisible.value = true
}

function triggerEditUpload(type: 'id_card' | 'license') {
  if (type === 'id_card') {
    editIdCardInput.value?.click()
  } else {
    editLicenseInput.value?.click()
  }
}

async function handleEditUpload(e: Event, type: 'id_card' | 'license') {
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
    const res: any = await uploadApi.uploadCustomer(file)
    if (res.success && res.data) {
      if (type === 'id_card') {
        editForm.id_card_images.push(res.data.url)
      } else {
        editForm.license_images.push(res.data.url)
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

function removeEditIdCardImage(index: number) {
  editForm.id_card_images.splice(index, 1)
}

function removeEditLicenseImage(index: number) {
  editForm.license_images.splice(index, 1)
}

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

function onCompleteDateTimeChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.value) {
    completeForm.actual_end_date = target.value.replace('T', ' ') + ':00'
  }
}

const unpaidAmount = computed(() => {
  return (order.value.total_amount || 0) - (order.value.paid_amount || 0)
})

const editEstimatedDays = computed(() => {
  if (editForm.start_date && editForm.end_date) {
    const start = new Date(editForm.start_date)
    const end = new Date(editForm.end_date)
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    return Math.max(1, Math.ceil(hours / 24))
  }
  return 0
})

const editEstimatedTotal = computed(() => {
  // 如果填了总租金则使用总租金
  if (editForm.total_amount && editForm.total_amount > 0) {
    return editForm.total_amount
  }
  // 否则按日租金计算
  return editEstimatedDays.value * editForm.daily_rate
})

const extendDurationText = computed(() => {
  if (!extendForm.new_end_date || !order.value.end_date) return ''
  const currentEnd = new Date(order.value.end_date)
  const newEnd = new Date(extendForm.new_end_date)
  const diffMs = newEnd.getTime() - currentEnd.getTime()
  if (diffMs <= 0) return ''
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(diffHours / 24)
  const hours = diffHours % 24
  if (days > 0 && hours > 0) {
    return `${days}天${hours}小时`
  } else if (days > 0) {
    return `${days}天`
  } else if (hours > 0) {
    return `${hours}小时`
  }
  return ''
})

async function loadOrder() {
  loading.value = true
  try {
    const res: any = await orderApi.getOne(route.params.id as string)
    if (res.success) {
      order.value = res.data
      completeForm.actual_end_date = dayjs().format('YYYY-MM-DD HH:mm:ss')
    }
  } catch (error) {
    console.error('加载订单失败', error)
    router.push('/orders')
  } finally {
    loading.value = false
  }
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
async function handlePickup() {
  submitting.value = true
  try {
    const res: any = await orderApi.updateStatus(order.value.id, {
      status: 'active',
      pickup_mileage: pickupForm.pickup_mileage,
      pickup_image: pickupForm.pickup_image || undefined
    })
    if (res.success) {
      ElMessage.success('取车成功')
      pickupDialogVisible.value = false
      pickupForm.pickup_mileage = undefined
      pickupForm.pickup_image = ''
      loadOrder()
    }
  } catch (error) {
    console.error('取车失败', error)
  } finally {
    submitting.value = false
  }
}

async function handleCancel() {
  try {
    await ElMessageBox.confirm('确定要取消该订单吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const res: any = await orderApi.cancel(order.value.id)
    if (res.success) {
      ElMessage.success('订单已取消')
      loadOrder()
    }
  } catch (error) {
    // 用户取消操作
  }
}

async function handleAddPayment() {
  const valid = await paymentFormRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    const res: any = await orderApi.addPayment(order.value.id, paymentForm)
    if (res.success) {
      ElMessage.success('支付记录添加成功')
      paymentDialogVisible.value = false
      paymentForm.amount = 0
      paymentForm.remarks = ''
      loadOrder()
    }
  } catch (error) {
    console.error('添加支付失败', error)
  } finally {
    submitting.value = false
  }
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
      completeForm.return_image = res.data.url
      ElMessage.success('上传成功')
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch (error) {
    ElMessage.error('上传失败')
  }
  target.value = ''
}

async function handleComplete() {
  submitting.value = true
  try {
    const res: any = await orderApi.updateStatus(order.value.id, {
      status: 'completed',
      actual_end_date: completeForm.actual_end_date || undefined,
      remarks: completeForm.remarks || undefined,
      return_mileage: completeForm.return_mileage,
      return_image: completeForm.return_image || undefined
    })
    if (res.success) {
      ElMessage.success('订单已完成')
      completeDialogVisible.value = false
      loadOrder()
    }
  } catch (error) {
    console.error('完成订单失败', error)
  } finally {
    submitting.value = false
  }
}

// 拉黑客户
async function handleAddToBlacklist() {
  try {
    const { value: reason } = await ElMessageBox.prompt('请输入拉黑原因', '添加到黑名单', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入拉黑原因',
      inputValidator: (val) => !!val?.trim() || '请输入拉黑原因'
    })
    
    const res: any = await blacklistApi.add({
      name: order.value.customer_name,
      phone: order.value.customer_phone,
      id_card: order.value.customer_id_card,
      reason: reason.trim()
    })
    
    if (res.success) {
      ElMessage.success('已添加到黑名单')
    }
  } catch (error) {
    // 取消
  }
}

// 加载可用车辆
async function loadVehicles() {
  try {
    const res: any = await vehicleApi.getList({ pageSize: 1000 })
    if (res.success) {
      vehicles.value = res.data.data
    }
  } catch (error) {
    console.error('加载车辆失败', error)
  }
}

// 加载订单来源
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

// 打开编辑对话框
async function openEditDialog() {
  await Promise.all([loadVehicles(), loadOrderSources()])
  Object.assign(editForm, {
    customer_name: order.value.customer_name,
    customer_phone: order.value.customer_phone,
    customer_id_card: order.value.customer_id_card || '',
    customer_license: order.value.customer_license || '',
    id_card_images: order.value.id_card_images || [],
    license_images: order.value.license_images || [],
    vehicle_id: order.value.vehicle_id,
    source_id: order.value.source_id || '',
    start_date: order.value.start_date,
    pickup_location: order.value.pickup_location || '',
    end_date: order.value.end_date,
    return_location: order.value.return_location || '',
    daily_rate: order.value.daily_rate || 0,
    total_amount: order.value.total_amount || 0,
    deposit: order.value.deposit || 0,
    deposit_waived: order.value.deposit_waived === 1,
    deposit_waived_expiry: order.value.deposit_waived_expiry || '',
    service_type: order.value.service_type || 'basic',
    contract_number: order.value.contract_number || '',
    remarks: order.value.remarks || ''
  })
  editDialogVisible.value = true
}

// 免押状态变更
function onEditDepositWaivedChange(waived: boolean) {
  if (waived) {
    // 勾选免押时，计算免押到期日期（还车后30天）
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

// 车辆选择变化
function onVehicleChange(id: string) {
  const vehicle = vehicles.value.find(v => v.id === id)
  if (vehicle) {
    editForm.daily_rate = vehicle.daily_rate
    editForm.deposit = vehicle.deposit
  }
}

// 提交编辑
async function handleEditSubmit() {
  const valid = await editFormRef.value?.validate()
  if (!valid) return

  submitting.value = true
  try {
    const res: any = await orderApi.update(order.value.id, editForm)
    if (res.success) {
      ElMessage.success('订单修改成功')
      editDialogVisible.value = false
      loadOrder()
    }
  } catch (error) {
    console.error('修改失败', error)
  } finally {
    submitting.value = false
  }
}

// 打开续租对话框
function openExtendDialog() {
  // 默认新还车时间为当前还车时间加1天
  if (order.value.end_date) {
    const date = new Date(order.value.end_date)
    date.setDate(date.getDate() + 1)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    extendForm.new_end_date = `${year}-${month}-${day} ${hours}:${minutes}:00`
  }
  // 默认续租金额为日租金
  extendForm.extend_amount = order.value.daily_rate || 0
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

// 提交续租
async function handleExtend() {
  if (!extendForm.new_end_date) {
    ElMessage.warning('请选择新的还车时间')
    return
  }
  submitting.value = true
  try {
    const res: any = await orderApi.extend(order.value.id, {
      new_end_date: extendForm.new_end_date,
      extend_amount: extendForm.extend_amount,
      has_payment: extendForm.has_payment,
      payment_amount: extendForm.has_payment ? extendForm.payment_amount : undefined,
      payment_method: extendForm.has_payment ? extendForm.payment_method : undefined
    })
    if (res.success) {
      ElMessage.success(`续租成功，续租金额 ¥${res.data.extend_amount}`)
      extendDialogVisible.value = false
      loadOrder()
    }
  } catch (error) {
    console.error('续租失败', error)
  } finally {
    submitting.value = false
  }
}

// 返回订单列表
function goBack() {
  router.back()
}

onMounted(() => loadOrder())
</script>

<style scoped>
.page-container {
  max-width: 600px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 12px;
}

.order-title {
  font-size: 16px;
  font-weight: 500;
}

.order-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-card {
  margin-bottom: 0;
}

.section-title {
  font-weight: 500;
  font-size: 14px;
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  padding: 4px 0;
}

.info-row .label {
  color: #909399;
}

.info-row .value {
  color: #303133;
}

.info-row a {
  color: #409EFF;
  text-decoration: none;
}

.text-primary { color: #409EFF; font-weight: 500; }
.text-success { color: #67C23A; }
.text-warning { color: #E6A23C; }
.text-danger { color: #F56C6C; font-weight: 500; }

.payment-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.payment-item {
  background: #fafafa;
  border-radius: 6px;
  padding: 10px;
}

.payment-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.payment-row:last-child {
  margin-bottom: 0;
}

.payment-type {
  color: #303133;
  font-size: 14px;
}

.payment-amount {
  color: #409EFF;
  font-weight: 500;
}

.payment-method, .payment-time {
  color: #909399;
  font-size: 12px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-buttons .el-button {
  width: 100%;
  margin: 0;
  justify-content: center;
}

.estimate {
  font-weight: 500;
  color: #409EFF;
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

/* 免押到期日期 */
.deposit-expiry {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}

/* 取车还车照片 */
.order-images {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.order-images .image-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.order-images .image-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.order-images .order-image {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid #dcdfe6;
}

.order-images .order-image:hover {
  border-color: #409EFF;
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
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #fff;
}
</style>