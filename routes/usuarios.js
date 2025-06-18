const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');

// Registro de usuario
router.post('/', async (req, res) => {
  try {
    const { nombre, contrasena } = req.body;

    // Validaciones
    if (!nombre || !contrasena) {
      return res.status(400).json({ mensaje: 'Nombre y contraseña son requeridos' });
    }

    if (nombre.trim().length < 3) {
      return res.status(400).json({ mensaje: 'El nombre debe tener al menos 3 caracteres' });
    }

    if (contrasena.trim().length < 6) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Verificar si el nombre ya está en uso
    const usuarioExistente = await Usuario.findOne({ nombre: nombre.trim() });
    if (usuarioExistente) {
      return res.status(400).json({ mensaje: 'El nombre de usuario ya está en uso' });
    }

    const nuevoUsuario = new Usuario({ 
      nombre: nombre.trim(), 
      contrasena: contrasena.trim(),
      biografia: '' // Biografía vacía por defecto
    });

    await nuevoUsuario.save();
    res.status(201).json({ 
      mensaje: 'Usuario creado exitosamente',
      nombre: nuevoUsuario.nombre,
      _id: nuevoUsuario._id
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ mensaje: 'El nombre de usuario ya existe' });
    } else {
      console.error('Error al crear usuario:', error);
      res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
  }
});

// POST /usuarios/:userId/follow - Follow a user
router.post('/:userId/follow', async (req, res) => {
  if (!req.session.usuario || !req.session.usuario._id) {
    return res.status(401).json({ error: 'No autenticado. Inicia sesión para seguir a otros usuarios.' });
  }
  try {
    const currentUserId = req.session.usuario._id;
    const userIdToFollow = req.params.userId;

    if (currentUserId === userIdToFollow) {
      return res.status(400).json({ error: 'No puedes seguirte a ti mismo.' });
    }

    const currentUser = await Usuario.findByIdAndUpdate(
      currentUserId,
      { $addToSet: { seguidos: userIdToFollow } },
      { new: true }
    );

    const userToFollow = await Usuario.findByIdAndUpdate(
      userIdToFollow,
      { $addToSet: { seguidores: currentUserId } },
      { new: true }
    );

    if (!currentUser || !userToFollow) {
      return res.status(404).json({ error: 'Uno o ambos usuarios no fueron encontrados.' });
    }

    res.status(200).json({ 
      message: 'Ahora sigues a este usuario.', 
      seguidos: currentUser.seguidos,
    });

  } catch (error) {
    console.error('Error al seguir usuario:', error);
    if (error.name === 'CastError') {
        return res.status(400).json({ error: 'ID de usuario inválido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /usuarios/:userId/unfollow - Unfollow a user
router.post('/:userId/unfollow', async (req, res) => {
  if (!req.session.usuario || !req.session.usuario._id) {
    return res.status(401).json({ error: 'No autenticado. Inicia sesión para dejar de seguir a otros usuarios.' });
  }
  try {
    const currentUserId = req.session.usuario._id;
    const userIdToUnfollow = req.params.userId;

    if (currentUserId === userIdToUnfollow) {
      return res.status(400).json({ error: 'No puedes dejar de seguirte a ti mismo.' });
    }

    const currentUser = await Usuario.findByIdAndUpdate(
      currentUserId,
      { $pull: { seguidos: userIdToUnfollow } },
      { new: true }
    );

    const userToUnfollow = await Usuario.findByIdAndUpdate(
      userIdToUnfollow,
      { $pull: { seguidores: currentUserId } },
      { new: true }
    );

    // Check if users were found by trying to fetch them again if the update didn't return them
    // (e.g. if $pull didn't modify anything because the ID wasn't there)
    const finalCurrentUser = currentUser || await Usuario.findById(currentUserId);
    const finalUserToUnfollow = userToUnfollow || await Usuario.findById(userIdToUnfollow);

    if (!finalCurrentUser || !finalUserToUnfollow) {
         return res.status(404).json({ error: 'Uno o ambos usuarios no fueron encontrados para la operación de dejar de seguir.' });
    }

    res.status(200).json({ 
        message: 'Has dejado de seguir a este usuario.',
        seguidos: finalCurrentUser.seguidos 
    });

  } catch (error) {
    console.error('Error al dejar de seguir usuario:', error);
    if (error.name === 'CastError') {
        return res.status(400).json({ error: 'ID de usuario inválido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.usuario && req.session.usuario._id) {
    return next();
  }
  res.status(401).json({ error: 'No autenticado. Inicia sesión para continuar.' });
};

// PUT /usuarios/me/tipoCuenta - Update account type for the logged-in user
router.put('/me/tipoCuenta', isAuthenticated, async (req, res) => {
  try {
    const { tipoCuenta } = req.body;
    const loggedInUserId = req.session.usuario._id;

    // Validate input
    if (!tipoCuenta || !['publica', 'privada'].includes(tipoCuenta)) {
      return res.status(400).json({ error: 'Valor de tipoCuenta inválido. Debe ser "publica" o "privada".' });
    }

    const usuario = await Usuario.findById(loggedInUserId);

    if (!usuario) {
      // This should ideally not happen if isAuthenticated works correctly and user is in session
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    usuario.tipoCuenta = tipoCuenta;
    await usuario.save();

    // It's good practice to return the updated part of the user or a success message.
    // Avoid returning the whole user object if it contains sensitive info not needed by this request.

    // Update tipoCuenta in session as well
    if (req.session.usuario) {
        req.session.usuario.tipoCuenta = usuario.tipoCuenta;
    }

    res.json({ mensaje: 'Tipo de cuenta actualizado correctamente.', tipoCuenta: usuario.tipoCuenta });

  } catch (error) {
    console.error('Error al actualizar tipo de cuenta:', error);
    res.status(500).json({ error: 'Error interno del servidor al actualizar el tipo de cuenta.' });
  }
});

// Obtener todos los usuarios
router.get('/', async (req, res) => {
  try {
    const usuarios = await Usuario.find();
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

// Iniciar sesión
router.post('/login', async (req, res) => {
  try {
    const { nombre, contrasena } = req.body;

    // Validaciones básicas
    if (!nombre || !contrasena) {
      return res.status(400).json({ mensaje: 'Nombre y contraseña son requeridos' });
    }

    // Buscar usuario con credenciales exactas
    const usuario = await Usuario.findOne({ 
      nombre: nombre.trim(), 
      contrasena: contrasena.trim() 
    });

    if (usuario) {
      // Guardar la sesión del usuario
      req.session.usuario = {
        _id: usuario._id,
        nombre: usuario.nombre,
        tipoCuenta: usuario.tipoCuenta // Add tipoCuenta to session
      };
      // Send back the same object that's stored in the session
      res.json({ 
        mensaje: 'Inicio de sesión exitoso',
        ...req.session.usuario // Include all session user data
      });
    } else {
      res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// Verificar sesión activa
router.get('/session', async (req, res) => { // Make it async
  if (req.session.usuario && req.session.usuario._id) {
    try {
      // Fetch the user from DB to get all fields including 'seguidos' and 'seguidores'
      const usuarioFromDB = await Usuario.findById(req.session.usuario._id)
        .select('-contrasena'); // Exclude password

      if (!usuarioFromDB) {
        // This case is unlikely if session exists but user is gone from DB
        req.session.destroy(); // Clear invalid session
        return res.status(401).json({ error: 'Sesión inválida o usuario no encontrado.' });
      }

      // Construct the session user object with all necessary fields
      const sessionUser = {
          _id: usuarioFromDB._id,
          nombre: usuarioFromDB.nombre,
          tipoCuenta: usuarioFromDB.tipoCuenta,
          biografia: usuarioFromDB.biografia, 
          fechaRegistro: usuarioFromDB.fechaRegistro,
          seguidores: usuarioFromDB.seguidores, // Array of ObjectIds
          seguidos: usuarioFromDB.seguidos     // Array of ObjectIds
      };

      // Update the session object itself
      req.session.usuario = sessionUser; 

      res.json(sessionUser); // Send the more complete user object
    } catch (error) {
      console.error("Error al obtener datos de sesión con seguidos/seguidores:", error);
      // If DB lookup fails, could send basic session info or an error.
      // Sending an error is safer to indicate data might be stale/incomplete.
      res.status(500).json({ error: 'Error al obtener datos completos de sesión.'});
    }
  } else {
    res.status(401).json({ error: 'No hay sesión activa' }); // Changed message key to 'error' for consistency
  }
});

// Cerrar sesión
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ mensaje: 'Error al cerrar sesión' });
    } else {
      res.json({ mensaje: 'Sesión cerrada correctamente' });
    }
  });
});

// Buscar usuarios por nombre
router.get('/buscar', async (req, res) => {
  const q = req.query.q;
  try {
    const usuarios = await Usuario.find({ nombre: { $regex: q, $options: 'i' } });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

// Obtener perfil por ID
router.get('/:id', async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.id)
      .populate('seguidores', '_id')
      .populate('seguidos', '_id');
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

// Actualizar biografía del usuario
router.put('/:id/biografia', async (req, res) => {
  try {
    const { biografia } = req.body;
    const usuarioId = req.params.id;

    // Verificar que el usuario esté logueado
    if (!req.session.usuario) {
      return res.status(401).json({ mensaje: 'Debes iniciar sesión' });
    }

    // Verificar que el usuario solo pueda editar su propia biografía
    if (req.session.usuario._id !== usuarioId) {
      return res.status(403).json({ mensaje: 'Solo puedes editar tu propia biografía' });
    }

    // Validar longitud de la biografía
    if (biografia && biografia.length > 500) {
      return res.status(400).json({ mensaje: 'La biografía no puede tener más de 500 caracteres' });
    }

    const usuario = await Usuario.findByIdAndUpdate(
      usuarioId,
      { biografia: biografia || '' },
      { new: true }
    );

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    res.json({ 
      mensaje: 'Biografía actualizada correctamente',
      biografia: usuario.biografia
    });
  } catch (error) {
    console.error('Error al actualizar biografía:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// Seguir/dejar de seguir usuario
router.post('/:id/seguir', async (req, res) => {
  try {
    const usuarioActualId = req.session.usuario._id;
    const usuarioObjetivoId = req.params.id;

    if (usuarioActualId === usuarioObjetivoId) {
      return res.status(400).json({ mensaje: 'No puedes seguirte a ti mismo' });
    }

    const actual = await Usuario.findById(usuarioActualId);
    const objetivo = await Usuario.findById(usuarioObjetivoId);

    if (!actual || !objetivo) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    const yaSigue = actual.seguidos.includes(usuarioObjetivoId);

    if (yaSigue) {
      actual.seguidos.pull(usuarioObjetivoId);
      objetivo.seguidores.pull(usuarioActualId);
    } else {
      actual.seguidos.push(usuarioObjetivoId);
      objetivo.seguidores.push(usuarioActualId);
    }

    await actual.save();
    await objetivo.save();

    res.json({ sigue: !yaSigue });
  } catch (error) {
    console.error('Error al seguir usuario:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// Agregar estas rutas al final del archivo de rutas, antes de module.exports = router;

// Actualizar nombre de usuario
router.put('/:id/nombre', async (req, res) => {
  try {
    const { nombre } = req.body;
    const usuarioId = req.params.id;

    if (!req.session.usuario) {
      return res.status(401).json({ mensaje: 'Debes iniciar sesión' });
    }

    if (req.session.usuario._id !== usuarioId) {
      return res.status(403).json({ mensaje: 'Solo puedes editar tu propio nombre' });
    }

    if (!nombre || nombre.trim().length < 3) {
      return res.status(400).json({ mensaje: 'El nombre debe tener al menos 3 caracteres' });
    }

    // Verificar si el nombre ya existe
    const nombreExiste = await Usuario.findOne({ 
      nombre: nombre.trim(), 
      _id: { $ne: usuarioId } 
    });

    if (nombreExiste) {
      return res.status(400).json({ mensaje: 'El nombre de usuario ya está en uso' });
    }

    const usuario = await Usuario.findByIdAndUpdate(
      usuarioId,
      { nombre: nombre.trim() },
      { new: true }
    );

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Actualizar sesión
    req.session.usuario.nombre = usuario.nombre;

    res.json({ 
      mensaje: 'Nombre actualizado correctamente',
      nombre: usuario.nombre
    });
  } catch (error) {
    console.error('Error al actualizar nombre:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// Cambiar contraseña
router.put('/:id/contrasena', async (req, res) => {
  try {
    const { contrasenaActual, contrasenaNueva } = req.body;
    const usuarioId = req.params.id;

    if (!req.session.usuario) {
      return res.status(401).json({ mensaje: 'Debes iniciar sesión' });
    }

    if (req.session.usuario._id !== usuarioId) {
      return res.status(403).json({ mensaje: 'Solo puedes cambiar tu propia contraseña' });
    }

    if (!contrasenaActual || !contrasenaNueva) {
      return res.status(400).json({ mensaje: 'Contraseña actual y nueva son requeridas' });
    }

    if (contrasenaNueva.trim().length < 6) {
      return res.status(400).json({ mensaje: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Verificar contraseña actual
    if (usuario.contrasena !== contrasenaActual.trim()) {
      return res.status(400).json({ mensaje: 'La contraseña actual es incorrecta' });
    }

    // Actualizar contraseña
    usuario.contrasena = contrasenaNueva.trim();
    await usuario.save();

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// GET /usuarios/:userId/seguidores - Fetch list of followers for a user
router.get('/:userId/seguidores', async (req, res) => {
  try {
    const { userId } = req.params;
    const usuario = await Usuario.findById(userId).populate({
      path: 'seguidores',
      select: 'nombre _id' // Select only name and ID for the list
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json(usuario.seguidores);
  } catch (error) {
    console.error('Error al obtener seguidores:', error);
    if (error.name === 'CastError') {
        return res.status(400).json({ error: 'ID de usuario inválido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /usuarios/:userId/siguiendo - Fetch list of users a user is following
router.get('/:userId/siguiendo', async (req, res) => {
  try {
    const { userId } = req.params;
    const usuario = await Usuario.findById(userId).populate({
      path: 'seguidos', // Correct field name in the Usuario model
      select: 'nombre _id' // Select only name and ID
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json(usuario.seguidos);
  } catch (error) {
    console.error('Error al obtener usuarios seguidos:', error);
    if (error.name === 'CastError') {
        return res.status(400).json({ error: 'ID de usuario inválido.' });
    }
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;