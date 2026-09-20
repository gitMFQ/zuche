-- 行驶证可能分正页与副页，改为最多存两张（JSON 数组），字段语义与 customers.license_images 对齐
ALTER TABLE vehicles ADD COLUMN license_images TEXT;

-- 老数据是单张的裸 URL，包成单元素数组，避免混着两种形态
UPDATE vehicles
SET license_images = json_array(license_image)
WHERE license_image IS NOT NULL AND license_image <> '';

ALTER TABLE vehicles DROP COLUMN license_image;
