const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('express-flash');
const path = require('path');
const dotenv = require('dotenv');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const bcrypt = require('bcryptjs');

dotenv.config();

// ============ KEEP AWAKE ============
const https = require('https');
setInterval(() => {
  const url = process.env.RENDER_URL || 'https://test-1dba.onrender.com';
  https.get(url, (res) => console.log(`✅ Keep-alive ping: ${res.statusCode}`))
    .on('error', (err) => console.log('❌ Keep-alive error:', err.message));
}, 5 * 60 * 1000);
// ====================================

const app = express();

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});

const upload = multer({
  storage: new CloudinaryStorage({
    cloudinary,
    params: { folder: 'wassitdz', allowed_formats: ['jpg','png','webp'] }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(flash());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success_msg = req.flash('success');
  res.locals.error_msg = req.flash('error');
  next();
});

app.set('view engine', 'ejs');

// ============ MODELS ============
const productSchema = new mongoose.Schema({
  name: String, price: Number, description: String,
  category: { type: String, default: 'efootball' },
  level: Number, coins: Number, gp: Number, stars: Number,
  image: { type: String, default: 'https://res.cloudinary.com/demo/image/upload/v1/default-account.jpg' },
  cloudinaryId: String,
  status: { type: String, default: 'available' },
  featured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const orderSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  customerName: String, customerPhone: String, customerEmail: String,
  paymentMethod: String,
  status: { type: String, default: 'pending' },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  username: String, password: String, role: String,
  name: String, phone: String
});

const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const User = mongoose.model('User', userSchema);
// ================================

// ============ MIDDLEWARE ============
const isAuth = (req, res, next) => {
  if (req.session.user) return next();
  req.flash('error', 'الرجاء تسجيل الدخول');
  res.redirect('/admin/login');
};
// ====================================

// ============ PUBLIC ROUTES ============
app.get('/', async (req, res) => {
  try {
    const featured = await Product.find({ featured: true, status: 'available' }).limit(6).sort('-createdAt');
    const latest = await Product.find({ status: 'available' }).limit(8).sort('-createdAt');
    res.render('index', { title: 'وسيط DZ', featured, latest });
  } catch (err) {
    res.render('index', { title: 'وسيط DZ', featured: [], latest: [] });
  }
});

app.get('/products', async (req, res) => {
  try {
    let query = { status: 'available' };
    if (req.query.category && req.query.category !== 'all') query.category = req.query.category;
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    let sort = { createdAt: -1 };
    if (req.query.sort === 'price_asc') sort = { price: 1 };
    if (req.query.sort === 'price_desc') sort = { price: -1 };
    
    const products = await Product.find(query).sort(sort);
    const categories = await Product.distinct('category');
    res.render('products', { title: 'الحسابات', products, categories, filters: req.query });
  } catch (err) {
    res.redirect('/');
  }
});

app.get('/product/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect('/products');
    
    const related = await Product.find({
      category: product.category,
      status: 'available',
      _id: { $ne: product._id }
    }).limit(4);
    
    res.render('product', { title: product.name, product, related });
  } catch (err) {
    res.redirect('/products');
  }
});

app.post('/product/:id/order', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.status !== 'available') {
      req.flash('error', 'المنتج غير متاح');
      return res.redirect(`/product/${req.params.id}`);
    }
    
    await Order.create({
      product: product._id,
      customerName: req.body.name,
      customerPhone: req.body.phone,
      customerEmail: req.body.email,
      paymentMethod: req.body.paymentMethod,
      notes: req.body.notes
    });
    
    product.status = 'pending';
    await product.save();
    
    req.flash('success', 'تم إرسال الطلب! سنتواصل معك قريباً');
    res.redirect(`/product/${product._id}`);
  } catch (err) {
    req.flash('error', 'حدث خطأ');
    res.redirect(`/product/${req.params.id}`);
  }
});

app.get('/contact/whatsapp/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate('product');
    if (!order) return res.redirect('/');
    
    const msg = encodeURIComponent(
      `السلام عليكم، أريد شراء حساب ${order.product.name} بسعر ${order.product.price} دج\n` +
      `الاسم: ${order.customerName}\nرقم الطلب: ${order._id}`
    );
    res.redirect(`https://wa.me/213${process.env.WHATSAPP || '555123456'}?text=${msg}`);
  } catch (err) {
    res.redirect('/');
  }
});

app.get('/contact/telegram/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate('product');
    if (!order) return res.redirect('/');
    
    const msg = encodeURIComponent(
      `السلام عليكم، أريد شراء حساب ${order.product.name} بسعر ${order.product.price} دج\n` +
      `الاسم: ${order.customerName}\nرقم الطلب: ${order._id}`
    );
    res.redirect(`https://t.me/${process.env.TELEGRAM || 'wassitdz_bot'}?text=${msg}`);
  } catch (err) {
    res.redirect('/');
  }
});
// ====================================

// ============ ADMIN ROUTES ============
app.get('/admin/login', (req, res) => {
  if (req.session.user) return res.redirect('/admin');
  res.render('admin-login', { title: 'تسجيل الدخول' });
});

app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    req.session.user = { username, role: 'admin' };
    req.flash('success', 'مرحباً بك');
    return res.redirect('/admin');
  }
  
  const user = await User.findOne({ username });
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.user = { id: user._id, username: user.username, role: user.role };
    req.flash('success', 'مرحباً بك');
    return res.redirect('/admin');
  }
  
  req.flash('error', 'بيانات غير صحيحة');
  res.redirect('/admin/login');
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

app.get('/admin', isAuth, async (req, res) => {
  try {
    const stats = {
      products: await Product.countDocuments(),
      available: await Product.countDocuments({ status: 'available' }),
      sold: await Product.countDocuments({ status: 'sold' }),
      orders: await Order.countDocuments(),
      pending: await Order.countDocuments({ status: 'pending' })
    };
    
    const recentOrders = await Order.find().populate('product').sort('-createdAt').limit(10);
    const recentProducts = await Product.find().sort('-createdAt').limit(10);
    
    res.render('admin-dashboard', { title: 'لوحة التحكم', stats, recentOrders, recentProducts });
  } catch (err) {
    res.redirect('/admin/login');
  }
});

app.get('/admin/products', isAuth, async (req, res) => {
  try {
    const products = await Product.find().sort('-createdAt');
    res.render('admin-products', { title: 'المنتجات', products });
  } catch (err) {
    res.redirect('/admin');
  }
});

app.get('/admin/products/new', isAuth, (req, res) => {
  res.render('admin-product-form', { title: 'إضافة منتج', product: null });
});

app.post('/admin/products', isAuth, upload.single('image'), async (req, res) => {
  try {
    const data = {
      name: req.body.name,
      price: req.body.price,
      description: req.body.description,
      category: req.body.category,
      level: req.body.level || null,
      coins: req.body.coins || 0,
      gp: req.body.gp || 0,
      stars: req.body.stars || null,
      status: req.body.status || 'available',
      featured: req.body.featured === 'on'
    };
    
    if (req.file) {
      data.image = req.file.path;
      data.cloudinaryId = req.file.filename;
    }
    
    await Product.create(data);
    req.flash('success', 'تمت الإضافة');
    res.redirect('/admin/products');
  } catch (err) {
    req.flash('error', 'فشلت الإضافة');
    res.redirect('/admin/products/new');
  }
});

app.get('/admin/products/:id/edit', isAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    res.render('admin-product-form', { title: 'تعديل منتج', product });
  } catch (err) {
    res.redirect('/admin/products');
  }
});

app.post('/admin/products/:id', isAuth, upload.single('image'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    product.name = req.body.name;
    product.price = req.body.price;
    product.description = req.body.description;
    product.category = req.body.category;
    product.level = req.body.level || null;
    product.coins = req.body.coins || 0;
    product.gp = req.body.gp || 0;
    product.stars = req.body.stars || null;
    product.status = req.body.status || 'available';
    product.featured = req.body.featured === 'on';
    
    if (req.file) {
      product.image = req.file.path;
      product.cloudinaryId = req.file.filename;
    }
    
    await product.save();
    req.flash('success', 'تم التحديث');
    res.redirect('/admin/products');
  } catch (err) {
    req.flash('error', 'فشل التحديث');
    res.redirect(`/admin/products/${req.params.id}/edit`);
  }
});

app.post('/admin/products/:id/delete', isAuth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    req.flash('success', 'تم الحذف');
  } catch (err) {
    req.flash('error', 'فشل الحذف');
  }
  res.redirect('/admin/products');
});

app.get('/admin/orders', isAuth, async (req, res) => {
  try {
    const orders = await Order.find().populate('product').sort('-createdAt');
    res.render('admin-orders', { title: 'الطلبات', orders });
  } catch (err) {
    res.redirect('/admin');
  }
});

app.post('/admin/orders/:id', isAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    order.status = req.body.status;
    await order.save();
    
    if (req.body.status === 'completed') {
      await Product.findByIdAndUpdate(order.product, { status: 'sold' });
    }
    
    req.flash('success', 'تم تحديث الحالة');
  } catch (err) {
    req.flash('error', 'فشل التحديث');
  }
  res.redirect('/admin/orders');
});

// Create default admin user
app.get('/admin/setup', async (req, res) => {
  try {
    const adminExists = await User.findOne({ username: process.env.ADMIN_USER });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASS, 10);
      await User.create({
        username: process.env.ADMIN_USER,
        password: hashedPassword,
        role: 'admin',
        name: 'مدير النظام'
      });
      res.send('✅ تم إنشاء حساب المدير');
    } else {
      res.send('ℹ️ حساب المدير موجود مسبقاً');
    }
  } catch (err) {
    res.send('❌ خطأ في إنشاء الحساب');
  }
});
// ====================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
