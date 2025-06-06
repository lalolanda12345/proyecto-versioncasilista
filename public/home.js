
let usuario = null;

// Verificar sesión activa
async function verificarSesion() {
  try {
    const res = await fetch('/usuarios/session');
    if (res.ok) {
      usuario = await res.json();
      document.getElementById('nombreUsuario').textContent = usuario.nombre;
      return true;
    } else {
      alert('❌ Debes iniciar sesión primero');
      window.location.href = 'index.html';
      return false;
    }
  } catch (error) {
    alert('❌ Error de conexión');
    window.location.href = 'index.html';
    return false;
  }
}

// Inicializar la página
async function inicializar() {
  const sesionValida = await verificarSesion();
  if (sesionValida) {
    cargarPublicaciones();
    // Actualizar publicaciones cada 3 segundos para simular tiempo real
    setInterval(cargarPublicaciones, 3000);
    configurarModal();
  }
}

// Configurar modal
function configurarModal() {
  const modal = document.getElementById('editModal');
  const closeBtn = document.querySelector('.close');
  const cancelBtn = document.getElementById('cancelEdit');
  
  closeBtn.onclick = () => modal.style.display = 'none';
  cancelBtn.onclick = () => modal.style.display = 'none';
  
  window.onclick = (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  };
}

// Cerrar sesión
document.getElementById('cerrarSesion').addEventListener('click', async () => {
  try {
    const res = await fetch('/usuarios/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.ok) {
      alert('✅ Sesión cerrada');
      window.location.href = 'index.html';
    } else {
      alert('❌ Error al cerrar sesión');
    }
  } catch (error) {
    alert('❌ Error de conexión');
  }
});

// Manejar nueva publicación
document.getElementById('publicacionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const contenido = document.getElementById('contenido').value;
  const imagenUrl = document.getElementById('imagenUrl').value;

  try {
    const publicacionData = { 
      usuario: usuario._id, 
      contenido: contenido 
    };
    
    if (imagenUrl) {
      publicacionData.imagen = imagenUrl;
    }

    const res = await fetch('/publicaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(publicacionData),
    });

    if (res.ok) {
      document.getElementById('contenido').value = '';
      document.getElementById('imagenUrl').value = '';
      cargarPublicaciones();
      alert('✅ Publicación creada exitosamente');
    } else {
      alert('❌ Error al crear la publicación');
    }
  } catch (error) {
    alert('❌ Error de conexión');
  }
});

// Manejar edición de publicación
document.getElementById('editForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const publicacionId = document.getElementById('editPublicacionId').value;
  const contenido = document.getElementById('editContenido').value;
  const imagenUrl = document.getElementById('editImagenUrl').value;

  try {
    const editData = {
      usuarioId: usuario._id,
      contenido: contenido
    };
    
    if (imagenUrl) {
      editData.imagen = imagenUrl;
    }

    const res = await fetch(`/publicaciones/${publicacionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    });

    if (res.ok) {
      document.getElementById('editModal').style.display = 'none';
      cargarPublicaciones();
      alert('✅ Publicación actualizada');
    } else {
      const error = await res.json();
      alert('❌ ' + error.mensaje);
    }
  } catch (error) {
    alert('❌ Error de conexión');
  }
});

// Cargar publicaciones
async function cargarPublicaciones() {
  try {
    const res = await fetch('/publicaciones');
    const publicaciones = await res.json();

    const lista = document.getElementById('listaPublicaciones');
    lista.innerHTML = '';

    publicaciones.reverse().forEach(pub => {
      const usuarioYaDioLike = pub.usuariosQueDieronLike && pub.usuariosQueDieronLike.includes(usuario._id);
      const likeButtonClass = usuarioYaDioLike ? 'like-btn liked' : 'like-btn';
      const likeButtonText = usuarioYaDioLike ? '💖' : '❤️';
      
      const esPropio = pub.usuario._id === usuario._id;
      
      const div = document.createElement('div');
      div.className = 'publicacion';
      div.innerHTML = `
        <div class="publicacion-header">
          <strong>${pub.usuario.nombre}</strong>
          <span class="fecha">${new Date(pub.fecha).toLocaleString()}</span>
        </div>
        <div class="publicacion-contenido">${pub.contenido}</div>
        ${pub.imagen ? `<img src="${pub.imagen}" alt="Imagen de publicación" class="publicacion-imagen" onerror="this.style.display='none'">` : ''}
        <div class="publicacion-footer">
          <button class="${likeButtonClass}" onclick="darLike('${pub._id}')">${likeButtonText} ${pub.likes}</button>
          ${esPropio ? `
            <div class="action-buttons">
              <button class="edit-btn" onclick="editarPublicacion('${pub._id}', '${pub.contenido.replace(/'/g, "\\'")}', '${pub.imagen || ''}')">✏️ Editar</button>
              <button class="delete-btn" onclick="eliminarPublicacion('${pub._id}')">🗑️ Eliminar</button>
            </div>
          ` : ''}
        </div>
      `;
      lista.appendChild(div);
    });
  } catch (error) {
    console.log('Error al cargar publicaciones:', error);
  }
}

// Función para dar like a una publicación
async function darLike(publicacionId) {
  try {
    const res = await fetch(`/publicaciones/${publicacionId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuarioId: usuario._id })
    });
    
    if (res.ok) {
      cargarPublicaciones(); // Recargar las publicaciones para mostrar el nuevo conteo
    } else {
      alert('❌ Error al dar like');
    }
  } catch (error) {
    alert('❌ Error de conexión');
  }
}

// Función para editar publicación
function editarPublicacion(publicacionId, contenido, imagen) {
  document.getElementById('editPublicacionId').value = publicacionId;
  document.getElementById('editContenido').value = contenido;
  document.getElementById('editImagenUrl').value = imagen || '';
  document.getElementById('editModal').style.display = 'block';
}

// Función para eliminar publicación
async function eliminarPublicacion(publicacionId) {
  if (confirm('¿Estás seguro de que quieres eliminar esta publicación?')) {
    try {
      const res = await fetch(`/publicaciones/${publicacionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId: usuario._id })
      });

      if (res.ok) {
        cargarPublicaciones();
        alert('✅ Publicación eliminada');
      } else {
        const error = await res.json();
        alert('❌ ' + error.mensaje);
      }
    } catch (error) {
      alert('❌ Error de conexión');
    }
  }
}

// Inicializar cuando se carga la página
inicializar();
