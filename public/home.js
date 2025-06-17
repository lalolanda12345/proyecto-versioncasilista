// Variable global para el usuario
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
      showNotification('Debes iniciar sesión primero', 'error');
      window.location.href = 'index.html';
      return false;
    }
  } catch (error) {
    showNotification('Error de conexión', 'error');
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
  }
}

// Cerrar sesión
document.getElementById('cerrarSesion').addEventListener('click', async () => {
  try {
    const res = await fetch('/usuarios/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.ok) {
      showNotification('Sesión cerrada', 'success');
      window.location.href = 'index.html';
    } else {
      showNotification('Error al cerrar sesión', 'error');
    }
  } catch (error) {
    showNotification('Error de conexión', 'error');
  }
});

// Manejar nueva publicación
document.getElementById('publicacionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const contenido = document.getElementById('contenido').value;

  try {
    const res = await fetch('/publicaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        usuario: usuario._id, 
        contenido: contenido 
      }),
    });

    if (res.ok) {
      document.getElementById('contenido').value = '';
      cargarPublicaciones();
      showNotification('Publicación creada exitosamente', 'success');
    } else {
      showNotification('Error al crear la publicación', 'error');
    }
  } catch (error) {
    showNotification('Error de conexión', 'error');
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
      const likeButtonText = usuarioYaDioLike ? '❤️' : '🤍';

      const div = document.createElement('div');
      div.className = 'publicacion';
      div.innerHTML = `
        <div class="publicacion-header">
          <strong>${pub.usuario ? pub.usuario.nombre : 'Usuario desconocido'}</strong>
          <span class="fecha">${new Date(pub.fecha).toLocaleString()}</span>
        </div>
        <div class="publicacion-contenido">${pub.contenido}</div>
        <div class="publicacion-footer">
          <button class="${likeButtonClass}" onclick="darLike('${pub._id}')">
            ${likeButtonText} ${pub.likes}
          </button>
        </div>
      `;
      lista.appendChild(div);
    });
  } catch (error) {
    console.error('Error al cargar publicaciones:', error);
  }
}

// Función para dar/quitar like a una publicación
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
      showNotification('Error al procesar like', 'error');
    }
  } catch (error) {
    showNotification('Error de conexión', 'error');
  }
}

// Buscar usuarios
document.getElementById('busquedaUsuario').addEventListener('input', async (e) => {
  const q = e.target.value.trim();
  const resultados = document.getElementById('resultadosUsuarios');
  resultados.innerHTML = '';

  if (q.length > 1) {
    try {
      const res = await fetch(`/usuarios/buscar?q=${encodeURIComponent(q)}`);
      const usuarios = await res.json();

      usuarios.forEach(u => {
        const li = document.createElement('li');
        li.textContent = u.nombre;
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => {
          window.location.href = `perfil.html?id=${u._id}`;
        });
        resultados.appendChild(li);
      });
    } catch (error) {
      console.error('Error al buscar usuarios:', error);
    }
  }
});

inicializar();