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

    // Check for ChatPrivilegio (active or otherwise)
    let privilegio = await ChatPrivilegio.findOne({
      $or: [
        { solicitante: emisorId, receptor: receptorId },
        { solicitante: receptorId, receptor: emisorId }
      ]
    });

    // Handle archived chat scenarios first
    if (privilegio && privilegio.isArchived) {
      if (privilegio.archivedBy && privilegio.archivedBy.toString() === receptorId.toString()) {
        // Message recipient archived the chat. Sender cannot send.
        return res.status(403).json({ 
          error: 'El otro usuario ha archivado esta conversación. No puedes enviar mensajes.', 
          type: 'archived_by_receptor',
          code: 'CHAT_ARCHIVED_BY_RECEPTOR'
        });
      } else if (privilegio.archivedBy && privilegio.archivedBy.toString() === emisorId.toString()) {
        // Sender archived the chat. Sending a message unarchives it.
        privilegio.isArchived = false;
        privilegio.archivedBy = null;

        // Ensure the privilege state is 'activo' and solicitante/receptor are correctly set for an active chat
        // If emisorId was originally the 'receptor' in the privilegio doc, and receptorId was 'solicitante',
        // we might need to flip them if our system defines 'solicitante' as the one who initiates an active phase.
        // For simplicity, if unarchiving by sending a message, we set the sender as solicitante.
        // This might need more nuanced handling if strict roles are maintained beyond 'pendiente'.
        if (privilegio.receptor.toString() === emisorId.toString()) {
            // The sender was the original receptor of a request. Flip them to be solicitante.
            // This case is less common if 'activo' usually means the original solicitante got their request approved.
            // However, to be robust for unarchiving:
            privilegio.solicitante = emisorId;
            privilegio.receptor = receptorId;
        }
        privilegio.estado = 'activo'; // Sending a message makes the chat active.
        await privilegio.save();
        // Now, 'privilegio' is unarchived and active. The code will flow into the next block.
      }
      // If isArchived is true but archivedBy is null (e.g. system archived, or old data),
      // allow message sending to proceed, which effectively unarchives it and assigns active state.
      // This case will fall through to the 'privilegio.estado === 'activo'' check or the 'else' for request creation.
      // If it was system-archived and state wasn't 'activo', it would then create a new request or message.
      // For now, we assume `archivedBy` is set if `isArchived` is true.
    }

    if (privilegio && privilegio.estado === 'activo') {
      // Active (or just became active) privilege exists, send message directly
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

// POST /mensajes/conversacion/:partnerUserId/archive - Archive a conversation
router.post('/conversacion/:partnerUserId/archive', async (req, res) => {
  if (!req.session.usuario || !req.session.usuario._id) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const userId = req.session.usuario._id;
  const { partnerUserId } = req.params;

  if (userId === partnerUserId) {
    return res.status(400).json({ error: 'Cannot archive a chat with yourself.' });
  }

  try {
    let privilegio = await ChatPrivilegio.findOne({
      $or: [
        { solicitante: userId, receptor: partnerUserId },
        { solicitante: partnerUserId, receptor: userId }
      ]
    });

    if (!privilegio) {
      return res.status(404).json({ error: 'Chat privilege record not found.' });
    }

    // Optional: Check if the chat is active before archiving
    // For now, only active chats can be archived. This could be expanded later.
    if (privilegio.estado !== 'activo') {
      return res.status(400).json({ error: 'Only active chats can be archived at the moment.' });
    }

    // Check if already archived by the same user
    if (privilegio.isArchived && privilegio.archivedBy && privilegio.archivedBy.toString() === userId.toString()) {
      // If already archived by this user, we can just return success or a specific message.
      // Re-saving doesn't hurt due to pre-save hook updating fechaActualizacion.
      return res.status(200).json({ message: 'Chat already archived by you.' });
    }

    privilegio.isArchived = true;
    privilegio.archivedBy = userId;
    // The pre-save hook on ChatPrivilegioSchema handles fechaActualizacion,
    // so no need to explicitly set `privilegio.fechaActualizacion = Date.now();` here.

    await privilegio.save();

    // TODO: Future enhancement - send a notification to the partnerUser that the chat was archived.
    // This would likely involve a separate notification system or a special type of message.

    res.status(200).json({ message: 'Chat archived successfully.' });

  } catch (error) {
    console.error('Error archiving chat:', error);
    res.status(500).json({ error: 'Error interno del servidor al archivar el chat.' });
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

    // Attempt to get current user ID from session for 'archivedByMe'
    const currentUserActualId = req.session.usuario ? req.session.usuario._id : null;

    const privilegio = await ChatPrivilegio.findOne({
      $or: [
        { solicitante: usuarioId1, receptor: usuarioId2 },
        { solicitante: usuarioId2, receptor: usuarioId1 }
      ]
    });

    let archivalStatus = {
      isArchived: false,
      archivedBy: null,
      archivedByMe: false,
      chatPrivilegioEstado: 'none' // Default state if no privilegio found
    };

    if (privilegio) {
      archivalStatus.isArchived = privilegio.isArchived || false;
      archivalStatus.archivedBy = privilegio.archivedBy || null;
      if (currentUserActualId && privilegio.isArchived && privilegio.archivedBy) {
        archivalStatus.archivedByMe = privilegio.archivedBy.toString() === currentUserActualId.toString();
      }
      archivalStatus.chatPrivilegioEstado = privilegio.estado || 'none';
    }

    res.json({
      messages: mensajes,
      archivalStatus: archivalStatus
    });
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
    let listaConversaciones = Object.values(conversaciones).sort((a,b) => b.fechaEnvio - a.fechaEnvio);

    // Augment conversations with ChatPrivilegio data
    const augmentedListaConversaciones = [];
    for (const conv of listaConversaciones) {
      const otroUsuarioId = conv.otroUsuario._id;
      const privilegio = await ChatPrivilegio.findOne({
        $or: [
          { solicitante: usuarioActualId, receptor: otroUsuarioId },
          { solicitante: otroUsuarioId, receptor: usuarioActualId }
        ]
      });

      const augmentedConv = { ...conv }; // Clone the conversation object

      if (privilegio) {
        augmentedConv.isArchived = privilegio.isArchived || false; // Default to false if undefined
        augmentedConv.archivedBy = privilegio.archivedBy || null;
        augmentedConv.archivedByMe = !!(privilegio.isArchived && privilegio.archivedBy && privilegio.archivedBy.toString() === usuarioActualId.toString());
        augmentedConv.chatPrivilegioEstado = privilegio.estado || 'none';
      } else {
        // Default values if no privilegio record is found (should be rare for active conversations)
        augmentedConv.isArchived = false;
        augmentedConv.archivedBy = null;
        augmentedConv.archivedByMe = false;
        augmentedConv.chatPrivilegioEstado = 'none'; // Or 'desconocido', 'no_establecido'
      }
      augmentedListaConversaciones.push(augmentedConv);
    }

    res.json(augmentedListaConversaciones);
  } catch (error) {
    console.error('Error al obtener conversaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener las conversaciones.' });
  }
});

module.exports = router;
