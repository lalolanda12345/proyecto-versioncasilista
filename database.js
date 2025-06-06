const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect('mongodb+srv://a23328050730533:proyecto@cluster0.grtul3k.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Conectado a MongoDB Atlas'))
.catch((err) => console.error('❌ Error de conexión:', err));