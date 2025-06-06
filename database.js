const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ Conectado a MongoDB Atlas'))
.catch((err) => console.error('❌ Error de conexión:', err));