import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { initDatabase } from './db/index.js';
import routes from './routes/index.js';
import { authMiddleware } from './middleware/auth.js';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// 创建uploads目录及子目录
const UPLOADS_DIR = join(__dirname, '../uploads');
const UPLOAD_SUBDIRS = ['inspection', 'insurance', 'violation', 'maintenance', 'vehicle', 'customer', 'other'];

if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 创建子目录
UPLOAD_SUBDIRS.forEach(subdir => {
  const subdirPath = join(UPLOADS_DIR, subdir);
  if (!existsSync(subdirPath)) {
    mkdirSync(subdirPath, { recursive: true });
  }
});

// 创建multer上传器工厂函数，支持指定子目录和文件类型
function createUploader(subdir: string, filePrefix: string, allowPdf = false) {
  const uploadDir = join(UPLOADS_DIR, subdir);
  
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = extname(file.originalname);
      cb(null, `${filePrefix}-${uniqueSuffix}${ext}`);
    }
  });

  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const allowedPdfTypes = ['application/pdf'];
  const allowedTypes = allowPdf ? [...allowedImageTypes, ...allowedPdfTypes] : allowedImageTypes;
  const fileTypeName = allowPdf ? '图片或PDF文件' : '图片文件';

  return multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB限制
    fileFilter: (_req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`只支持${fileTypeName}`));
      }
    }
  });
}

// 不同类型的上传器（保险支持PDF）
const uploaders = {
  inspection: createUploader('inspection', 'inspection'),
  insurance: createUploader('insurance', 'insurance', true), // 支持图片和PDF
  violation: createUploader('violation', 'violation'),
  maintenance: createUploader('maintenance', 'maintenance'),
  vehicle: createUploader('vehicle', 'vehicle'),
  customer: createUploader('customer', 'customer'),
  other: createUploader('other', 'file')
};

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 提供图片访问
app.use('/uploads', express.static(UPLOADS_DIR));

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// 通用上传处理函数
function handleUpload(uploader: multer.Multer, subdir: string, allowPdf = false) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    uploader.single('image')(req, res, (err: any) => {
      if (err) {
        if (err.message.includes('只支持')) {
          const msg = allowPdf 
            ? '只支持 JPG、PNG、GIF、WEBP 格式的图片或 PDF 文件'
            : '只支持 JPG、PNG、GIF、WEBP 格式的图片';
          return res.status(400).json({ success: false, message: msg });
        }
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, message: '文件大小不能超过 10MB' });
        }
        console.error('上传错误:', err);
        return res.status(500).json({ success: false, message: '上传失败' });
      }
      
      try {
        if (!req.file) {
          return res.status(400).json({ success: false, message: '请选择文件' });
        }
        const fileUrl = `/uploads/${subdir}/${req.file.filename}`;
        const isPdf = req.file.mimetype === 'application/pdf';
        res.json({ 
          success: true, 
          data: { 
            filename: req.file.filename,
            url: fileUrl,
            type: isPdf ? 'pdf' : 'image'
          } 
        });
      } catch (error) {
        console.error('上传失败:', error);
        res.status(500).json({ success: false, message: '上传失败' });
      }
    });
  };
}

// 年检证图片上传接口
app.post('/api/upload/inspection', authMiddleware, handleUpload(uploaders.inspection, 'inspection'));

// 保险图片/PDF上传接口
app.post('/api/upload/insurance', authMiddleware, handleUpload(uploaders.insurance, 'insurance', true));

// 违章图片上传接口
app.post('/api/upload/violation', authMiddleware, handleUpload(uploaders.violation, 'violation'));

// 保养图片上传接口
app.post('/api/upload/maintenance', authMiddleware, handleUpload(uploaders.maintenance, 'maintenance'));

// 车辆图片上传接口
app.post('/api/upload/vehicle', authMiddleware, handleUpload(uploaders.vehicle, 'vehicle'));

// 客户图片上传接口
app.post('/api/upload/customer', authMiddleware, handleUpload(uploaders.customer, 'customer'));

// 其他图片上传接口
app.post('/api/upload', authMiddleware, handleUpload(uploaders.other, 'other'));

// API 路由
app.use('/api', routes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

// 启动服务器
function start() {
  try {
    initDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 服务器启动成功!`);
      console.log(`📍 地址: http://localhost:${PORT}`);
      console.log(`📚 API: http://localhost:${PORT}/api`);
      console.log(`💚 健康检查: http://localhost:${PORT}/health\n`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

start();
