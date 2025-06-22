const mongoose = require('mongoose');

const ChatPrivilegioSchema = new mongoose.Schema({
  solicitante: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true 
  },
  receptor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true 
  },
  estado: { 
    type: String, 
    enum: ['pendiente', 'activo', 'bloqueado'], 
    default: 'pendiente',
    required: true
  },
  fechaActualizacion: { 
    type: Date, 
    default: Date.now 
  },
  isHidden: {
    type: Boolean, 
    default: false, 
    index: true 
  },
  hiddenForUsers: [{ 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: [] 
  }],
  initiatorOfHide: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null
  }
});

ChatPrivilegioSchema.index({ solicitante: 1, receptor: 1 }, { unique: true });

ChatPrivilegioSchema.pre('save', function(next) {
  this.fechaActualizacion = Date.now();
  next();
});

module.exports = mongoose.model('ChatPrivilegio', ChatPrivilegioSchema);
