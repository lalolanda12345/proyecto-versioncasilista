const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Conectado a MongoDB Atlas'))
.catch((err) => console.error('❌ Error de conexión:', err));
const mongoose = require('mongoose');

const mongoUri = process.env.MONGO_URI || 'mongodb+srv://tu-usuario:tu-password@cluster.mongodb.net/redsocial';

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Conectado a MongoDB Atlas');
}).catch(err => {
  console.error('❌ Error conectando a MongoDB:', err);
});

module.exports = mongoose;
