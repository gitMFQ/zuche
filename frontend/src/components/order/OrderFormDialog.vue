<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isCreate ? '新建订单' : '编辑订单'"
    width="90%"
    :style="{ maxWidth: '500px' }"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="70px" size="default">
      <el-divider content-position="left">客户信息</el-divider>
      <el-form-item v-if="isCreate" label="常用客户">
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
        <el-input v-model="form.customer_phone" :placeholder="phonePlaceholder" type="tel" @blur="onPhoneBlur" />
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
              <img :src="getImageUrl(img)" @click="previewImage(form.id_card_images, idx)" alt="订单证件照片，点击可放大查看" />
              <div class="image-remove" @click="removeIdCardImage(idx)" role="button" tabindex="0" aria-label="删除这张照片" @keydown.enter.prevent="removeIdCardImage(idx)" @keydown.space.prevent="removeIdCardImage(idx)">×</div>
            </div>
            <div v-if="form.id_card_images.length < 2" class="upload-btn" @click="triggerUpload('id_card')" role="button" tabindex="0" aria-label="上传照片" @keydown.enter.prevent="triggerUpload('id_card')" @keydown.space.prevent="triggerUpload('id_card')">
              <el-icon><Plus /></el-icon>
            </div>
          </div>
          <input ref="idCardInput" type="file" accept="image/*" style="display: none" @change="handleUpload($event, 'id_card')" />
        </div>
      </el-form-item>
      <el-form-item label="驾驶证">
        <el-input v-model="form.customer_license" placeholder="驾驶证号（可选）" />
      </el-form-item>
      <el-form-item label="驾驶证照片">
        <div class="mini-upload">
          <div class="image-list">
            <div v-for="(img, idx) in form.license_images" :key="idx" class="image-item">
              <img :src="getImageUrl(img)" @click="previewImage(form.license_images, idx)" alt="订单证件照片，点击可放大查看" />
              <div class="image-remove" @click="removeLicenseImage(idx)" role="button" tabindex="0" aria-label="删除这张照片" @keydown.enter.prevent="removeLicenseImage(idx)" @keydown.space.prevent="removeLicenseImage(idx)">×</div>
            </div>
            <div v-if="form.license_images.length < 2" class="upload-btn" @click="triggerUpload('license')" role="button" tabindex="0" aria-label="上传照片" @keydown.enter.prevent="triggerUpload('license')" @keydown.space.prevent="triggerUpload('license')">
              <el-icon><Plus /></el-icon>
            </div>
          </div>
          <input ref="licenseInput" type="file" accept="image/*" style="display: none" @change="handleUpload($event, 'license')" />
        </div>
      </el-form-item>

      <el-divider content-position="left">车辆信息</el-divider>
      <el-form-item label="车辆" prop="vehicle_id">
        <el-select
          v-model="form.vehicle_id"
          placeholder="选择车辆"
          style="width: 100%"
          :disabled="props.order?.status === 'active'"
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
          :value="formatDateTimeLocal(form.start_date)"
          class="native-datetime-input"
          @change="onStartDateTimeChange"
        />
      </el-form-item>
      <el-form-item v-if="inlineLocations" label="取车地点">
        <el-input v-model="form.pickup_location" placeholder="取车地点（选填）" />
      </el-form-item>
      <el-form-item label="还车" prop="end_date">
        <input
          type="datetime-local"
          :value="formatDateTimeLocal(form.end_date)"
          class="native-datetime-input"
          @change="onEndDateTimeChange"
        />
      </el-form-item>
      <el-form-item v-if="inlineLocations" label="还车地点">
        <el-input v-model="form.return_location" placeholder="还车地点（选填）" />
      </el-form-item>
      <el-form-item label="日租金">
        <el-input-number v-model="form.daily_rate" :min="0" placeholder="选填" style="width: 100%" />
      </el-form-item>
      <el-form-item label="总租金">
        <el-input-number v-model="form.total_amount" :min="0" placeholder="可直接填写总租金" style="width: 100%" />
      </el-form-item>
      <template v-if="isCreate">
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
      </template>
      <el-form-item label="免押">
        <el-switch v-model="form.deposit_waived" @change="onDepositWaivedChange" />
      </el-form-item>
      <el-form-item v-if="!form.deposit_waived" label="押金">
        <el-input-number v-model="form.deposit" :min="0" style="width: 100%" />
      </el-form-item>
      <el-form-item v-if="form.deposit_waived" label="免押到期">
        <input
          v-if="isMobile"
          v-model="form.deposit_waived_expiry"
          type="date"
          class="native-date-input"
          style="width: 100%"
        />
        <el-date-picker
          v-else
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

      <template v-if="isCreate">
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
        <el-form-item label="取还方式">
          <el-radio-group v-model="form.delivery_type" class="service-radio-group" @change="onDeliveryTypeChange">
            <el-radio-button v-for="item in DELIVERY_TYPE_OPTIONS" :key="item.value" :value="item.value">
              {{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="取车位置">
          <el-input v-model="form.pickup_location" :placeholder="form.delivery_type === 'store' ? '到店取车默认为门店' : '取车位置（选填）'" />
        </el-form-item>
        <el-form-item label="还车位置">
          <el-input v-model="form.return_location" :placeholder="form.delivery_type === 'store' ? '到店取车默认为门店' : '还车位置（选填）'" />
        </el-form-item>
      </template>
      <template v-else>
        <el-form-item label="订单来源">
          <el-select v-model="form.source_id" placeholder="选择订单来源（可选）" style="width: 100%" clearable>
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
        <template v-if="!inlineLocations">
          <el-form-item label="取车位置">
            <el-input v-model="form.pickup_location" placeholder="取车位置（选填）" />
          </el-form-item>
          <el-form-item label="还车位置">
            <el-input v-model="form.return_location" placeholder="还车位置（选填）" />
          </el-form-item>
        </template>
      </template>
      <el-form-item label="备注">
        <el-input v-model="form.remarks" type="textarea" :rows="2" placeholder="备注信息" />
      </el-form-item>

      <!-- 应收与开票：台账「租金台账」的两列。只在编辑时出现 —— 新建还没结算 -->
      <template v-if="!isCreate">
        <el-divider content-position="left">结算与开票</el-divider>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="开票金额">
              <el-input-number v-model="form.invoice_amount" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="发票状态">
              <el-select v-model="form.invoice_status" style="width: 100%">
                <el-option v-for="o in INVOICE_STATUS_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="结算状态">
          <el-select v-model="form.settle_status" style="width: 100%">
            <el-option v-for="o in SETTLE_STATUS_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="结算备注">
          <el-input v-model="form.settle_remarks" placeholder="如：只转利润，未转全部金额" />
        </el-form-item>
      </template>
      <el-form-item label="预估">
        <span class="estimate">{{ estimatedDays }} 天，共 ¥{{ estimatedTotal }}</span>
        <span v-if="isCreate && selectedSource" class="net-amount">，到账 ¥{{ netAmount }}</span>
        <el-tag v-if="isCreate && form.service_type" :type="getServiceTagType(form.service_type)" size="small" style="margin-left: 8px">
          {{ getServiceLabel(form.service_type) }}
        </el-tag>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { blacklistApi, uploadApi } from '../../api'
import { useMobile } from '../../composables/useMobile'
import {
  DELIVERY_TYPE_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  STORE_LOCATION_TEXT
} from '../../utils/constants'
import { formatDateTimeLocal, getImageUrl, getServiceLabel, getServiceTagType } from '../../utils/helpers'
import { INVOICE_STATUS_OPTIONS, SETTLE_STATUS_OPTIONS } from '../../utils/constants'

/**
 * 新建 / 编辑订单表单弹窗。
 *
 * Orders 与 OrderDetail 原先各有一份近乎逐行相同的表单（新建 + 两处编辑），
 * 这里合并成一个，差异由 props 表达：
 *   - order 为空 → 新建（多出常用客户、黑名单预检、预付、取还方式、到账预估）
 *   - phoneRequired / vehicleRequired / inlineLocations → OrderDetail 编辑视图的
 *     必填项与「取车地点紧跟取车时间」的排布，Orders 编辑是另一种排布
 */
const props = defineProps<{
  visible: boolean
  order: any
  vehicles?: any[]
  orderSources?: any[]
  regularCustomers?: any[]
  submitting?: boolean
  phoneRequired?: boolean
  vehicleRequired?: boolean
  inlineLocations?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', payload: Record<string, unknown>): void
  (e: 'dates-change', start: string, end: string): void
  (e: 'preview', images: string[], index: number): void
}>()

const { isMobile } = useMobile()
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const idCardInput = ref<HTMLInputElement>()
const licenseInput = ref<HTMLInputElement>()
const selectedRegularCustomer = ref('')
const blacklistWarning = ref('')
const blacklistReason = ref('')

const isCreate = computed(() => !props.order)
// 原来的两处编辑视图手机号占位文案不同，跟着必填开关走
const phonePlaceholder = computed(() => (props.phoneRequired ? '手机号' : '选填'))

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
  delivery_type: 'delivery',
  remarks: '',
  invoice_amount: 0,
  invoice_status: 'none',
  settle_status: 'unpaid',
  settle_remarks: '',
  // 预付相关（仅新建）
  has_prepay: false,
  prepay_amount: 0,
  prepay_method: 'wechat',
  prepay_type: 'rent'
})

const PHONE_RULE = { pattern: /^(1[3-9]\d{9})?$/, message: '手机号格式不正确', trigger: 'blur' }
const STRICT_PHONE_RULES = [
  { required: true, message: '请输入手机号', trigger: 'blur' },
  { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
]
const DATE_RULES = {
  start_date: [{ required: true, message: '请选择起租日期', trigger: 'change' }],
  end_date: [{ required: true, message: '请选择还车日期', trigger: 'change' }]
}

const rules = computed<FormRules>(() => {
  if (isCreate.value) {
    return {
      customer_name: [{ required: true, message: '请输入客户姓名', trigger: 'blur' }],
      // 手机号选填：平台导入的客户可能没有手机号
      customer_phone: [PHONE_RULE],
      vehicle_id: [{ required: true, message: '请选择车辆', trigger: 'change' }],
      source_id: [{ required: true, message: '请选择订单来源', trigger: 'change' }],
      ...DATE_RULES
    }
  }
  return {
    customer_name: [{ required: true, message: '请输入客户姓名', trigger: 'blur' }],
    customer_phone: props.phoneRequired ? STRICT_PHONE_RULES : [PHONE_RULE],
    ...(props.vehicleRequired ? { vehicle_id: [{ required: true, message: '请选择车辆', trigger: 'change' }] } : {}),
    ...DATE_RULES
  }
})

watch(
  () => props.visible,
  (val) => {
    dialogVisible.value = val
    if (val) {
      initForm()
    }
  }
)

watch(dialogVisible, (val) => {
  emit('update:visible', val)
})

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 新建时的默认取还时间：现在 ~ 明天同一时刻 */
function defaultDateRange(): { start: string; end: string } {
  const now = new Date()
  const hours = pad(now.getHours())
  const minutes = pad(now.getMinutes())
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return {
    start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${hours}:${minutes}:00`,
    end: `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())} ${hours}:${minutes}:00`
  }
}

function blankForm() {
  const { start, end } = defaultDateRange()
  return {
    customer_name: '',
    customer_phone: '',
    customer_id_card: '',
    customer_license: '',
    id_card_images: [] as string[],
    license_images: [] as string[],
    vehicle_id: '',
    source_id: '',
    start_date: start,
    end_date: end,
    daily_rate: 0,
    total_amount: 0,
    deposit: 0,
    deposit_waived: false,
    deposit_waived_expiry: '',
    service_type: 'basic',
    contract_number: '',
    pickup_location: '',
    return_location: '',
    delivery_type: 'delivery',
    remarks: '',
    invoice_amount: 0,
    invoice_status: 'none',
    settle_status: 'unpaid',
    settle_remarks: '',
    has_prepay: false,
    prepay_amount: 0,
    prepay_method: 'wechat',
    prepay_type: 'rent'
  }
}

function initForm() {
  selectedRegularCustomer.value = ''
  blacklistWarning.value = ''
  blacklistReason.value = ''

  if (isCreate.value) {
    Object.assign(form, blankForm())
  } else {
    const detail = props.order
    Object.assign(form, blankForm(), {
      customer_name: detail.customer_name ?? '',
      customer_phone: detail.customer_phone ?? '',
      customer_id_card: detail.customer_id_card || detail.id_card || '',
      customer_license: detail.customer_license || detail.license_number || '',
      id_card_images: [...(detail.id_card_images || [])],
      license_images: [...(detail.license_images || [])],
      vehicle_id: detail.vehicle_id ?? '',
      source_id: detail.source_id || '',
      start_date: detail.start_date ?? '',
      end_date: detail.end_date ?? '',
      daily_rate: detail.daily_rate || 0,
      total_amount: detail.total_amount || 0,
      deposit: detail.deposit || 0,
      deposit_waived: detail.deposit_waived === 1,
      deposit_waived_expiry: detail.deposit_waived_expiry || '',
      service_type: detail.service_type || 'basic',
      contract_number: detail.contract_number || '',
      pickup_location: detail.pickup_location || '',
      return_location: detail.return_location || '',
      remarks: detail.remarks || '',
      invoice_amount: detail.invoice_amount ?? 0,
      invoice_status: detail.invoice_status || 'none',
      settle_status: detail.settle_status || 'unpaid',
      settle_remarks: detail.settle_remarks || ''
    })
  }

  emitDatesIfReady()
}

/** 取还填齐后通知父的可重新拉取可用车辆（编辑时排除本单） */
function emitDatesIfReady() {
  if (form.start_date && form.end_date) {
    emit('dates-change', form.start_date, form.end_date)
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
  return (props.orderSources || []).find((s: any) => s.id === form.source_id)
})

const netAmount = computed(() => {
  if (selectedSource.value) {
    const rate = (selectedSource.value as any).commission_rate || 0
    return Math.round(estimatedTotal.value * (100 - rate) / 100)
  }
  return estimatedTotal.value
})

function previewImage(images: string[], index: number) {
  emit('preview', images, index)
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

  const label = type === 'id_card' ? '身份证' : '驾驶证'
  try {
    const res = await uploadApi.uploadCustomer(file, `${form.customer_name || '客户'}-${label}`)
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

function onPhoneBlur() {
  if (isCreate.value) {
    void checkBlacklist()
  }
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
      blacklistWarning.value = '该客户在黑名单中！'
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

function onRegularCustomerChange(customerId: string) {
  if (customerId) {
    const customer = (props.regularCustomers || []).find((c: any) => c.id === customerId)
    if (customer) {
      form.customer_name = customer.name
      form.customer_phone = customer.phone
      form.customer_id_card = customer.id_card || ''
      form.customer_license = customer.license_number || ''
      // 检查黑名单
      void checkBlacklist()
    }
  }
}

function onVehicleChange(id: string) {
  const vehicle = (props.vehicles || []).find((v: any) => v.id === id)
  if (vehicle) {
    form.daily_rate = vehicle.daily_rate || 0
    form.deposit = vehicle.deposit || 0
  }
}

// 处理原生日期时间输入
function onStartDateTimeChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.value) {
    // datetime-local 格式: YYYY-MM-DDTHH:mm -> YYYY-MM-DD HH:mm:ss
    form.start_date = target.value.replace('T', ' ') + ':00'
  }
  emitDatesIfReady()
}

function onEndDateTimeChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.value) {
    form.end_date = target.value.replace('T', ' ') + ':00'
  }
  emitDatesIfReady()
}

// 到店取车/还车都在门店完成，地址默认填「门店」；切回送车上门时把门店清掉
function onDeliveryTypeChange(type: string) {
  if (type === 'store') {
    form.pickup_location = STORE_LOCATION_TEXT
    form.return_location = STORE_LOCATION_TEXT
    return
  }
  if (form.pickup_location === STORE_LOCATION_TEXT) form.pickup_location = ''
  if (form.return_location === STORE_LOCATION_TEXT) form.return_location = ''
}

// 免押状态变更：勾选时默认到期日为还车后 30 天
function onDepositWaivedChange(waived: boolean) {
  if (waived) {
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

function buildPayload(): Record<string, unknown> {
  const base: Record<string, unknown> = {
    customer_name: form.customer_name,
    customer_phone: form.customer_phone,
    customer_id_card: form.customer_id_card,
    customer_license: form.customer_license,
    id_card_images: form.id_card_images,
    license_images: form.license_images,
    vehicle_id: form.vehicle_id,
    source_id: form.source_id,
    start_date: form.start_date,
    end_date: form.end_date,
    daily_rate: form.daily_rate,
    total_amount: form.total_amount,
    deposit: form.deposit,
    deposit_waived: form.deposit_waived,
    deposit_waived_expiry: form.deposit_waived_expiry,
    service_type: form.service_type,
    contract_number: form.contract_number,
    pickup_location: form.pickup_location,
    return_location: form.return_location,
    remarks: form.remarks
  }
  if (!isCreate.value) {
    // 编辑接口才消费结算/开票字段；新建时还没结算，传了也无意义
    return {
      ...base,
      invoice_amount: form.invoice_amount,
      invoice_status: form.invoice_status,
      settle_status: form.settle_status,
      settle_remarks: form.settle_remarks
    }
  }
  // 新建多出预付与取还方式；编辑接口不消费这些字段，保持原来的提交内容不变
  return {
    ...base,
    delivery_type: form.delivery_type,
    has_prepay: form.has_prepay,
    prepay_amount: form.prepay_amount,
    prepay_method: form.prepay_method,
    prepay_type: form.prepay_type
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  emit('submit', buildPayload())
}
</script>

<style scoped>
:deep(.el-divider__text) {
  font-size: 13px;
  color: var(--sk-color-info);
  padding: 0 10px;
}

.estimate {
  font-weight: 500;
  color: var(--primary-color);
}

.net-amount {
  font-weight: 500;
  color: var(--sk-color-success);
  margin-left: 8px;
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
  color: var(--sk-color-info);
}

.mini-upload .upload-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
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
  border-color: var(--primary-color);
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

/* 暗色模式 */
html.dark :deep(.el-divider__text) {
  color: var(--text-color-secondary);
}

html.dark .estimate {
  color: var(--primary-color);
}

html.dark .mini-upload .image-item {
  border-color: var(--border-color);
}
</style>
