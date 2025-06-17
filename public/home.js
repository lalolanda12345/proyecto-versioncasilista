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

// Función para mostrar un diálogo de confirmación personalizado
function showConfirmationDialog(message, onConfirm, onCancel) {
  // Remover diálogo existente si lo hay
  const existingDialog = document.getElementById('confirmationDialog');
  if (existingDialog) {
    existingDialog.remove();
  }

  // Crear elementos del diálogo
  const dialog = document.createElement('div');
  dialog.id = 'confirmationDialog';
  dialog.className = 'confirmation-dialog';

  const messageP = document.createElement('p');
  messageP.textContent = message;
  dialog.appendChild(messageP);

  const buttonsDiv = document.createElement('div');
  buttonsDiv.className = 'confirmation-dialog-buttons';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Confirm';
  confirmBtn.className = 'confirm-btn';
  confirmBtn.onclick = () => {
    onConfirm();
    dialog.remove();
  };
  buttonsDiv.appendChild(confirmBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'cancel-btn';
  cancelBtn.onclick = () => {
    if (onCancel) {
      onCancel();
    }
    dialog.remove();
  };
  buttonsDiv.appendChild(cancelBtn);

  dialog.appendChild(buttonsDiv);
  document.body.appendChild(dialog);

  // Agregar estilos para el diálogo
  const styleId = 'dialogStyles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      .confirmation-dialog {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: white;
        padding: 20px;
        border: 1px solid #ccc;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1000;
        border-radius: 8px;
        text-align: center;
      }
      .confirmation-dialog p {
        margin-top: 0;
        margin-bottom: 15px;
        font-size: 16px;
      }
      .confirmation-dialog-buttons button {
        margin: 0 10px;
        padding: 10px 20px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
      }
      .confirm-btn {
        background-color: #d9534f;
        color: white;
      }
      .cancel-btn {
        background-color: #f0f0f0;
        color: #333;
      }
    `;
    document.head.appendChild(style);
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

      // Añadir botón de eliminar solo si el usuario es el autor de la publicación
      if (usuario && pub.usuario && usuario._id === pub.usuario._id) {
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-post-btn';
        deleteButton.textContent = 'Delete';
        deleteButton.style.marginLeft = '10px'; // Un poco de espacio
        deleteButton.style.backgroundColor = '#dc3545';
        deleteButton.style.color = 'white';
        deleteButton.style.border = 'none';
        deleteButton.style.padding = '5px 10px';
        deleteButton.style.borderRadius = '4px';
        deleteButton.style.cursor = 'pointer';
        deleteButton.onclick = function() {
          showConfirmationDialog('Are you sure you want to delete this post?', () => {
            eliminarPublicacion(pub._id);
          });
        };
        // Encontrar el footer de la publicación y añadir el botón
        const footer = div.querySelector('.publicacion-footer');
        if (footer) {
          footer.appendChild(deleteButton);
        }
      }
      lista.appendChild(div);
    });
  } catch (error) {
    console.error('Error al cargar publicaciones:', error);
    showNotification('Error al cargar publicaciones. Intenta de nuevo más tarde.', 'error');
  }
}

// Función para eliminar una publicación
async function eliminarPublicacion(postId) {
  try {
    const res = await fetch(`/publicaciones/${postId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        // Aquí podrías incluir headers de autorización si fueran necesarios, ej:
        // 'Authorization': `Bearer ${token}`
      }
    });

    if (res.ok) {
      showNotification('Publicación eliminada exitosamente', 'success');
      cargarPublicaciones(); // Recargar las publicaciones
    } else {
      const errorData = await res.json();
      showNotification(`Error al eliminar la publicación: ${errorData.message || res.statusText}`, 'error');
    }
  } catch (error) {
    console.error('Error en eliminarPublicacion:', error);
    showNotification('Error de conexión al intentar eliminar la publicación.', 'error');
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