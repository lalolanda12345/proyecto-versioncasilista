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

    // Check if sender and receiver are the same
    if (emisorId === receptorId) {
      return res.status(400).json({ error: 'No puedes enviarte mensajes a ti mismo.' });
    }

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

    // The old 'isArchived' logic block is removed.
    // New logic: If a message is sent and a privilege exists, reset its hide/status fields.
    let privilegioWasModified = false;
    if (privilegio) {
        // If a message is sent, the chat should become fully active and visible for both.
        // Reset all hide-related fields.
        let needsReset = false;
        if (privilegio.estado !== 'activo') { privilegio.estado = 'activo'; needsReset = true; }
        if (privilegio.isHidden !== false) { privilegio.isHidden = false; needsReset = true; }
        if (privilegio.initiatorOfHide !== null) { privilegio.initiatorOfHide = null; needsReset = true; }
        // statusForOtherUser is already removed from model, so no check/reset needed for it here.
        if (privilegio.hiddenForUsers && privilegio.hiddenForUsers.length > 0) {
            privilegio.hiddenForUsers = [];
            needsReset = true;
        }
        if (needsReset) {
            privilegioWasModified = true;
        }
    }

    if (privilegio && privilegio.estado === 'activo') {
      // Active (or became active by resetting fields) privilege exists, send message directly.
      const nuevoMensaje = new Mensaje({
        emisor: emisorId,
        receptor: receptorId,
        contenido
      });
      const mensajeGuardado = await nuevoMensaje.save();
      await mensajeGuardado.populate('emisor', 'nombre');
      await mensajeGuardado.populate('receptor', 'nombre');

      if (privilegioWasModified) { // Only save if it was actually modified
        await privilegio.save();
      }
      return res.status(201).json({ type: 'mensaje', data: mensajeGuardado });
    } else {
      // No active privilege (even after potential un-hiding), or no privilege at all.
      // This path should lead to creating a SolicitudMensaje.
      // If 'privilegio' was null and now we need to create a Solicitud, 
      // we also need a 'pendiente' ChatPrivilegio.

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

// POST /mensajes/conversacion/:partnerIdWhoInitiatedHide/confirm-delete - User B confirms deletion
router.post('/conversacion/:partnerIdWhoInitiatedHide/confirm-delete', async (req, res) => {
  try {
    if (!req.session.usuario || !req.session.usuario._id) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const userId = req.session.usuario._id; // This is User B
    const { partnerIdWhoInitiatedHide } = req.params; // This is User A

    const privilegio = await ChatPrivilegio.findOne({
      $and: [
        { $or: [{ solicitante: userId, receptor: partnerIdWhoInitiatedHide }, { solicitante: partnerIdWhoInitiatedHide, receptor: userId }] },
        { initiatorOfHide: partnerIdWhoInitiatedHide }
        // Removed: { statusForOtherUser: 'pending_action' } 
      ]
    });

    if (!privilegio) {
      // If chat not found, or if partnerIdWhoInitiatedHide wasn't the initiator (e.g., state changed by other means)
      return res.status(404).json({ error: 'Chat no encontrado o acción no válida para el estado actual del chat.' });
    }

    // User B (userId) is confirming deletion. Add them to hiddenForUsers.
    if (!privilegio.hiddenForUsers.includes(userId)) {
      privilegio.hiddenForUsers.push(userId);
    }

    // The initiator (partnerIdWhoInitiatedHide / User A) must be in hiddenForUsers for this to proceed.
    if (privilegio.hiddenForUsers.includes(partnerIdWhoInitiatedHide.toString()) && privilegio.hiddenForUsers.includes(userId.toString())) {
      // Both users have effectively agreed to delete. Proceed with permanent deletion.
      const userOneOriginal = privilegio.solicitante; 
      const userTwoOriginal = privilegio.receptor;   

      await Mensaje.deleteMany({
        $or: [
          { emisor: userOneOriginal, receptor: userTwoOriginal },
          { emisor: userTwoOriginal, receptor: userOneOriginal }
        ]
      });
      await ChatPrivilegio.deleteOne({ _id: privilegio._id });

      return res.status(200).json({ message: 'Chat eliminado permanentemente.' });
    } else {
      // This implies User A (initiator) was NOT in hiddenForUsers, which is a logic flaw if previous steps worked.
      // Or, this endpoint was called inappropriately.
      console.error('Error lógico en confirm-delete: El iniciador del ocultamiento no estaba en la lista hiddenForUsers, o el usuario actual no fue añadido correctamente.');
      // We'll save User B's intention to hide, but won't delete yet.
      // No statusForOtherUser to set to 'normal' anymore.
      await privilegio.save(); 
      return res.status(400).json({ error: 'No se pudo completar la eliminación. El estado del chat ha sido actualizado.' });
    }
  } catch (error) {
    console.error('Error en POST /mensajes/conversacion/:partnerIdWhoInitiatedHide/confirm-delete:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'ID de usuario inválido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Obsolete routes POST .../archive and POST .../hide-archived are REMOVED.

// POST /mensajes/conversacion/:partnerUserId/hide - Phase 1: Initiator (User A) hides the chat.
router.post('/conversacion/:partnerUserId/hide', async (req, res) => {
  try {
    if (!req.session.usuario || !req.session.usuario._id) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const userId = req.session.usuario._id; // User A (initiator)
    const { partnerUserId } = req.params; // User B

    if (userId === partnerUserId) {
      return res.status(400).json({ error: 'No puedes ocultar un chat contigo mismo.' });
    }

    let privilegio = await ChatPrivilegio.findOne({
      $or: [
        { solicitante: userId, receptor: partnerUserId },
        { solicitante: partnerUserId, receptor: userId }
      ]
    });

    if (!privilegio) {
      // If no privilegio, create one. User A is initiating the hide.
      // Determine consistent solicitante/receptor for new record
      const ids = [userId.toString(), partnerUserId.toString()].sort();
      privilegio = new ChatPrivilegio({
        solicitante: ids[0],
        receptor: ids[1],
        estado: 'activo', 
        hiddenForUsers: [userId], 
        initiatorOfHide: userId,
        // statusForOtherUser: 'pending_action', // Field removed
        isHidden: false 
      });
    } else {
      // Privilegio exists, update it for User A's hide action
      if (!privilegio.hiddenForUsers.includes(userId)) {
        privilegio.hiddenForUsers.push(userId);
      }
      privilegio.initiatorOfHide = userId; 
      // privilegio.statusForOtherUser = 'pending_action'; // Field removed
      privilegio.isHidden = false; 

      // Crucially, DO NOT delete messages or the ChatPrivilegio document here.
      // That's deferred for User B's explicit action or User A's later confirmation of deletion.
    }

    await privilegio.save();
    // Notify User A that the chat is hidden from their list and User B will be notified.
    res.status(200).json({ message: 'Conversación oculta de tu lista. El otro usuario será notificado del cambio de estado del chat.' });

  } catch (error) {
    console.error('Error en POST /mensajes/conversacion/:partnerUserId/hide:', error);
    if (error.name === 'CastError') { // Simplified CastError check
        return res.status(400).json({ error: 'ID de usuario inválido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor.' });
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

    const currentUserSessionId = req.session.usuario._id; // Ensure this is correctly obtained

    const privilegio = await ChatPrivilegio.findOne({
      $or: [
        { solicitante: usuarioId1, receptor: usuarioId2 },
        { solicitante: usuarioId2, receptor: usuarioId1 }
      ]
    });

    let chatStatus = {
      isHidden: false, 
      chatPrivilegioEstado: 'none',
      showPendingActionNotification: false, 
      initiatorName: null, 
      allowMessageSending: true, 
      chatPrivilegioId: null 
      // showReactivationPendingNotification is removed
    };

    if (privilegio) {
      chatStatus.isHidden = privilegio.isHidden || false; 
      chatStatus.chatPrivilegioEstado = privilegio.estado || 'none';
      chatStatus.chatPrivilegioId = privilegio._id; 

      const currentUserIdString = currentUserSessionId.toString();
      const initiatorIdString = privilegio.initiatorOfHide ? privilegio.initiatorOfHide.toString() : null;

      if (initiatorIdString && initiatorIdString !== currentUserIdString) { 
        // Current user is User B, and User A initiated the hide.
        // The 'pending_action' state for User B is implicitly known by initiatorOfHide being set to User A.
        chatStatus.showPendingActionNotification = true; 
        const initiator = await Usuario.findById(privilegio.initiatorOfHide).select('nombre');
        chatStatus.initiatorName = initiator ? initiator.nombre : 'El otro usuario';
        chatStatus.allowMessageSending = false;
      } else if (initiatorIdString && initiatorIdString === currentUserIdString) { 
        // Current user is User A (the initiator). They also cannot send messages until resolved.
         chatStatus.allowMessageSending = false;
         // Optionally add a flag: chatStatus.isCurrentUserInitiatorAndWaiting = true;
      }
      // No need to check for 'reactivation_requested' as statusForOtherUser is removed.
    }

    res.json({
      messages: mensajes,
      chatStatus: chatStatus 
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

      // Check if the conversation is hidden for the current user
      let isHiddenForCurrentUser = false;
      if (privilegio && privilegio.hiddenForUsers && privilegio.hiddenForUsers.includes(usuarioActualId)) {
        isHiddenForCurrentUser = true;
      }

      if (!isHiddenForCurrentUser) {
        const augmentedConv = { ...conv }; // Clone the conversation object

        if (privilegio) {
          // Add relevant fields from privilegio.
          // isArchived, archivedBy, archivedByMe are deprecated/removed from ChatPrivilegio model.
          // isHidden is the new field (renamed from isArchived).
          augmentedConv.isHidden = privilegio.isHidden || false; 
          augmentedConv.chatPrivilegioEstado = privilegio.estado || 'none';
          // Do not send sensitive arrays like hiddenForUsers to the client.
        } else {
          // Default values if no privilegio record is found
          augmentedConv.isHidden = false;
          augmentedConv.chatPrivilegioEstado = 'none';
        }
        augmentedListaConversaciones.push(augmentedConv);
      }
    }

    res.json(augmentedListaConversaciones);
  } catch (error) {
    console.error('Error al obtener conversaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener las conversaciones.' });
  }
});

module.exports = router;
