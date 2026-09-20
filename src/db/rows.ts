/**
 * 各表的行类型。D1 返回的是 unknown，这里统一声明，
 * 让 controller 层不需要 `as any` 就能拿到字段。
 */

export interface UserRow {
  id: string;
  username: string;
  password: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  status: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  id_card: string | null;
  license_number: string | null;
  license_expiry: string | null;
  address: string | null;
  remarks: string | null;
  status: number;
  created_at: string;
  updated_at: string;
  id_card_images: string | null;
  license_images: string | null;
  is_regular: number;
  source_id: string | null;
  source_name: string | null;
}

export interface VehicleRow {
  id: string;
  plate_number: string;
  brand: string;
  model: string;
  color: string | null;
  year: number | null;
  seats: number;
  daily_rate: number;
  deposit: number;
  status: string;
  mileage: number;
  last_maintenance: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  vin: string | null;
  engine_number: string | null;
  license_images: string | null;
  registration_image: string | null;
  is_new_energy: number;
  transmission: string | null;
  fuel_type: string | null;
  body_type: string | null;
  doors: number | null;
}

export interface OrderRow {
  id: string;
  order_no: string;
  customer_id: string;
  vehicle_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  actual_end_date: string | null;
  daily_rate: number;
  deposit: number;
  total_amount: number;
  paid_amount: number;
  status: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  source_id: string | null;
  source_name: string | null;
  commission_rate: number;
  net_amount: number | null;
  service_type: string;
  deposit_waived: number;
  deposit_waived_expiry: string | null;
  pickup_mileage: number | null;
  return_mileage: number | null;
  pickup_image: string | null;
  return_image: string | null;
  contract_number: string | null;
  pickup_location: string | null;
  return_location: string | null;
  platform: string | null;
  external_no: string | null;
  import_batch_id: string | null;
  actual_start_date: string | null;
  violation_deposit: number;
  cancel_reason: string | null;
  cancelled_at: string | null;
  delivery_type: string | null;
  pickup_driver_id: string | null;
  pickup_driver_name: string | null;
  return_driver_id: string | null;
  return_driver_name: string | null;
  booked_model: string | null;
}

export interface OrderFeeRow {
  id: string;
  order_id: string;
  fee_category: string;
  fee_name: string;
  receivable: number;
  received: number;
  refunded: number;
  platform: string | null;
  created_at: string;
}

export interface OrderExtensionRow {
  id: string;
  order_id: string;
  original_end_date: string;
  new_end_date: string;
  extend_days: number;
  extend_amount: number;
  payment_method: string | null;
  operator_id: string | null;
  remarks: string | null;
  created_at: string;
}

export interface ImportBatchRow {
  id: string;
  platform: string;
  filename: string | null;
  total_rows: number;
  success_rows: number;
  skipped_rows: number;
  failed_rows: number;
  new_customers: number;
  new_vehicles: number;
  operator_id: string | null;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  order_id: string;
  amount: number;
  payment_method: string;
  payment_type: string;
  remarks: string | null;
  created_at: string;
}

export interface ViolationRow {
  id: string;
  order_id: string | null;
  vehicle_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  plate_number: string;
  violation_type: string;
  violation_date: string;
  location: string | null;
  fine_amount: number;
  penalty_points: number;
  images: string | null;
  status: string;
  handle_date: string | null;
  handle_remarks: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  penalty_fee: number;
  collected_penalty: number;
  collected_fine: number;
  fee_remarks: string | null;
  handle_type: string;
  license_deposit: number;
}

export interface BlacklistRow {
  id: string;
  customer_id: string | null;
  name: string;
  phone: string;
  id_card: string | null;
  reason: string;
  order_id: string | null;
  operator_id: string | null;
  operator_name: string | null;
  status: number;
  created_at: string;
  updated_at: string;
}

export interface OrderSourceRow {
  id: string;
  name: string;
  commission_rate: number;
  color: string;
  remarks: string | null;
  status: number;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRow {
  id: string;
  vehicle_id: string;
  plate_number: string;
  type: string;
  maintenance_date: string;
  cost: number;
  mileage: number;
  garage: string | null;
  next_maintenance_date: string | null;
  next_maintenance_mileage: number | null;
  remarks: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  images: string | null;
}

export interface InsuranceRow {
  id: string;
  vehicle_id: string;
  plate_number: string;
  insurance_type: string;
  insurance_company: string;
  policy_number: string | null;
  start_date: string;
  end_date: string;
  premium: number;
  coverage_amount: number;
  beneficiary: string | null;
  remarks: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  documents: string | null;
}

export interface InspectionRow {
  id: string;
  vehicle_id: string;
  plate_number: string;
  expiry_date: string;
  certificate_image: string | null;
  remarks: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SettingRow {
  key: string;
  value: string | null;
  updated_at: string;
}

export interface OperationLogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}
