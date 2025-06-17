const express = require('express');
const router = express.Router();
const Mensaje = require('../models/Mensaje');
const Usuario = require('../models/Usuario'); // Needed for checking user existence and populating names

// POST /mensajes - Send a new message
router.post('/', async (req, res) => {
  try {
    const { emisor, receptor, contenido } = req.body;

    // Basic validation
    if (!emisor || !receptor || !contenido) {
      return res.status(400).json({ error: 'Faltan campos requeridos: emisor, receptor, contenido.' });
    }

    // Check if users exist (optional, but good practice)
    const emisorExists = await Usuario.findById(emisor);
    const receptorExists = await Usuario.findById(receptor);

    if (!emisorExists || !receptorExists) {
      return res.status(404).json({ error: 'Emisor o receptor no encontrado.' });
    }

    const nuevoMensaje = new Mensaje({
      emisor,
      receptor,
      contenido
    });

    const mensajeGuardado = await nuevoMensaje.save();
    await mensajeGuardado.populate('emisor', 'nombre');
    await mensajeGuardado.populate('receptor', 'nombre');

    res.status(201).json(mensajeGuardado);
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ error: 'Error interno del servidor al enviar el mensaje.' });
  }
});

// GET /mensajes/conversacion/:usuarioId1/:usuarioId2 - Fetch message history between two users
router.get('/conversacion/:usuarioId1/:usuarioId2', async (req, res) => {
  try {
    const { usuarioId1, usuarioId2 } = req.params;

    const mensajes = await Mensaje.find({
      $or: [
        { emisor: usuarioId1, receptor: usuarioId2 },
        { emisor: usuarioId2, receptor: usuarioId1 }
      ]
    })
    .populate('emisor', 'nombre')
    .populate('receptor', 'nombre')
    .sort({ fechaEnvio: 1 }); // Sort by date ascending

    res.json(mensajes);
  } catch (error) {
    console.error('Error al obtener conversación:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener la conversación.' });
  }
});

// GET /mensajes/conversaciones - Fetch list of conversations for the current user (req.session.usuario._id)
router.get('/conversaciones', async (req, res) => {
  if (!req.session.usuario || !req.session.usuario._id) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  const usuarioActualId = req.session.usuario._id;

  try {
    const mensajes = await Mensaje.find({
      $or: [{ emisor: usuarioActualId }, { receptor: usuarioActualId }]
    })
    .sort({ fechaEnvio: -1 }) // Get latest messages first for grouping
    .populate('emisor', 'nombre')
    .populate('receptor', 'nombre');

    const conversaciones = {};
    mensajes.forEach(mensaje => {
      // Determine the other user in the conversation
      const otroUsuarioId = mensaje.emisor._id.toString() === usuarioActualId ? mensaje.receptor._id.toString() : mensaje.emisor._id.toString();
      const otroUsuarioNombre = mensaje.emisor._id.toString() === usuarioActualId ? mensaje.receptor.nombre : mensaje.emisor.nombre;

      if (!conversaciones[otroUsuarioId] || conversaciones[otroUsuarioId].fechaEnvio < mensaje.fechaEnvio) {
        conversaciones[otroUsuarioId] = {
          otroUsuario: { _id: otroUsuarioId, nombre: otroUsuarioNombre },
          ultimoMensaje: mensaje.contenido,
          fechaEnvio: mensaje.fechaEnvio,
          emisorUltimoMensaje: mensaje.emisor.nombre,
          esEmisor: mensaje.emisor._id.toString() === usuarioActualId
        };
      }
    });

    // Convert conversations object to an array
    const listaConversaciones = Object.values(conversaciones).sort((a,b) => b.fechaEnvio - a.fechaEnvio);

    res.json(listaConversaciones);
  } catch (error) {
    console.error('Error al obtener conversaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener las conversaciones.' });
  }
});

module.exports = router;
