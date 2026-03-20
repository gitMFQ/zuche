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

// 创建uploads目录
const UPLOADS_DIR = join(__dirname, '../uploads');
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 配置multer存储
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = extname(file.originalname);
    cb(null, `inspection-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB限制
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件'));
    }
  }
});

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

// 图片上传接口
app.post('/api/upload', authMiddleware, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.message === '只支持图片文件') {
        return res.status(400).json({ success: false, message: '只支持 JPG、PNG、GIF、WEBP 格式的图片' });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: '图片大小不能超过 10MB' });
      }
      console.error('上传错误:', err);
      return res.status(500).json({ success: false, message: '上传失败' });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: '请选择图片文件' });
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({ 
        success: true, 
        data: { 
          filename: req.file.filename,
          url: fileUrl 
        } 
      });
    } catch (error) {
      console.error('上传失败:', error);
      res.status(500).json({ success: false, message: '上传失败' });
    }
  });
});

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
async function start() {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
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
