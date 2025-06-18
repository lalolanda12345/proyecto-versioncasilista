const express = require('express');
const router = express.Router();
const Mensaje = require('../models/Mensaje');
const Usuario = require('../models/Usuario'); // Needed for checking user existence and populating names
const SolicitudMensaje = require('../models/SolicitudMensaje');
const ChatPrivilegio = require('../models/ChatPrivilegio');

// POST /mensajes - Handles sending messages or creating message requests
router.post('/', async (req, res) => {
  try {
    const { emisor: emisorId, receptor: receptorId, contenido } = req.body;

    // Basic validation
    if (!emisorId || !receptorId || !contenido) {
      return res.status(400).json({ error: 'Faltan campos requeridos: emisor, receptor, contenido.' });
    }

    // Check if users exist
    const emisorExists = await Usuario.findById(emisorId);
    const receptorDoc = await Usuario.findById(receptorId); // Fetch full receptor document

    if (!emisorExists || !receptorDoc) {
      return res.status(404).json({ error: 'Emisor o receptor no encontrado.' });
    }

    // Proceed with ChatPrivilegio and SolicitudMensaje logic for all users.

    // Check for an active ChatPrivilegio
    let privilegio = await ChatPrivilegio.findOne({
      $or: [
        { solicitante: emisorId, receptor: receptorId },
        { solicitante: receptorId, receptor: emisorId }
      ]
    });

    if (privilegio && privilegio.estado === 'activo') {
      // Active privilege exists, send message directly
      const nuevoMensaje = new Mensaje({
        emisor: emisorId,
        receptor: receptorId,
        contenido
      });
      const mensajeGuardado = await nuevoMensaje.save();
      await mensajeGuardado.populate('emisor', 'nombre');
      await mensajeGuardado.populate('receptor', 'nombre');
      return res.status(201).json({ type: 'mensaje', data: mensajeGuardado });
    } else {
      // No active privilege, handle as a request

      // Check if a pending SolicitudMensaje already exists from this emisor to this receptor
      const solicitudExistente = await SolicitudMensaje.findOne({
        emisor: emisorId,
        receptor: receptorId,
        estado: 'pendiente'
      });

      if (solicitudExistente) {
        return res.status(409).json({ error: 'Ya existe una solicitud pendiente para este receptor.', type: 'solicitud_existente', data: solicitudExistente });
      }

      // If no existing ChatPrivilegio record, or if it's not 'pendiente' (e.g. was 'bloqueado' and then removed), create one.
      // Or if one exists as 'pendiente' from emisor to receptor.
      if (!privilegio || (privilegio.solicitante.toString() === emisorId && privilegio.receptor.toString() === receptorId && privilegio.estado !== 'pendiente')) {
         // If a privilege record exists but it's for the other direction and pending, we should not overwrite.
         // This logic focuses on creating a new privilege if one doesn't exist from emisor to receptor, or if it was blocked.
         // A more robust check might be needed if 'bloqueado' is actively used and not removed.
         // For now, if no 'activo' privilege, and no 'pendiente' SolicitudMensaje from emisor->receptor, proceed to create SolicitudMensaje and ensure/create 'pendiente' ChatPrivilegio.

         // Ensure a 'pendiente' ChatPrivilegio from emisor to receptor
         // This will create if not exists, or find the existing one.
         // Using findOne to check before creating ChatPrivilegio specific to emisorId -> receptorId direction
         let currentDirectionPrivilegio = await ChatPrivilegio.findOne({ solicitante: emisorId, receptor: receptorId });
         if (!currentDirectionPrivilegio) {
            currentDirectionPrivilegio = new ChatPrivilegio({
                solicitante: emisorId,
                receptor: receptorId,
                estado: 'pendiente'
            });
            await currentDirectionPrivilegio.save();
         } else if (currentDirectionPrivilegio.estado !== 'pendiente' && currentDirectionPrivilegio.estado !== 'activo') {
           // If it was e.g. 'bloqueado' (and not removed on reject), reset to 'pendiente' for a new request.
           // Or handle 'bloqueado' as a hard stop if desired. Current logic implies re-requestable.
           currentDirectionPrivilegio.estado = 'pendiente';
           await currentDirectionPrivilegio.save();
        } else if (currentDirectionPrivilegio.estado === 'activo'){
            // This case implies the initial $or check for privilegio should have caught it.
            // If it's active from receptor to emisor, but not emisor to receptor, and we want strict directionality on first request:
            // This part of logic might need to be more nuanced if ChatPrivilegio is strictly directional vs. a general "channel open" status.
            // The $or findOne implies channel is open if active in EITHER direction.
            // For now, if it's 'activo', it should have been caught by the earlier "if (privilegio && privilegio.estado === 'activo')"
        }
      }


      const nuevaSolicitud = new SolicitudMensaje({
        emisor: emisorId,
        receptor: receptorId,
        contenido
      });
      const solicitudGuardada = await nuevaSolicitud.save();
      await solicitudGuardada.populate('emisor', 'nombre');
      await solicitudGuardada.populate('receptor', 'nombre');

      return res.status(201).json({ type: 'solicitud', data: solicitudGuardada });
    }
  } catch (error) {
    // Check for unique index violation for ChatPrivilegio if it's not handled gracefully above
    if (error.code === 11000 && error.keyPattern && error.keyPattern['solicitante'] && error.keyPattern['receptor']) {
        // This might happen if two requests try to create ChatPrivilegio simultaneously.
        // The findOne + save logic for ChatPrivilegio should ideally prevent this.
        // If it still occurs, one option is to re-fetch and ensure state.
        console.error('Error de índice duplicado al crear ChatPrivilegio:', error);
        return res.status(500).json({ error: 'Error al procesar la solicitud debido a una condición de carrera. Intente de nuevo.' });
    }
    console.error('Error al enviar mensaje/solicitud:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar el mensaje/solicitud.' });
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
