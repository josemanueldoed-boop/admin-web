// ============================================================
//  admin.js — CreatorWeb | Panel Administrativo
//  Firebase Auth + Firestore: CRUD completo
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, getDocs, addDoc, setDoc, updateDoc,
  deleteDoc, doc, getDoc, query, orderBy, where, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Firebase Config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCG5hiyp-nuJoZnuH0XjqyA8Gx_4ATSFCg",
  authDomain: "creator-web-8b6f3.firebaseapp.com",
  projectId: "creator-web-8b6f3",
  storageBucket: "creator-web-8b6f3.firebasestorage.app",
  messagingSenderId: "542294059774",
  appId: "1:542294059774:web:f7c0bbb96147812a1313af",
  measurementId: "G-DJ0RX7RDB9"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── Global state ─────────────────────────────────────────────
let currentUser = null;
let valoresToSave = []; // array local de valores en edición

// ── Utils ────────────────────────────────────────────────────
function showToast(msg, type = "info") {
  const container = document.getElementById("toast-container");
  const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
  const div = document.createElement("div");
  div.className = `toast ${type}`;
  div.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${msg}</span>`;
  container.appendChild(div);
  setTimeout(() => div.remove(), 4200);
}

function setLoading(btnId, loading, label = "") {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) btn.innerHTML = '<span class="spinner"></span> Guardando...';
  else if (label) btn.innerHTML = label;
}

function formatTimestamp(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

// ── AUTH ─────────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("admin-app").style.display   = "flex";
    const inicial = (user.email || "A")[0].toUpperCase();
    document.getElementById("user-avatar").textContent = inicial;
    document.getElementById("user-name").textContent   = user.email;
    initAdmin();
  } else {
    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("admin-app").style.display   = "none";
  }
});

window.loginAdmin = async function() {
  const email = document.getElementById("login-email").value.trim();
  const pass  = document.getElementById("login-pass").value;
  if (!email || !pass) { showToast("Completa el correo y contraseña", "error"); return; }
  const btn = document.getElementById("btn-login");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    const msgs = {
      "auth/user-not-found": "Usuario no encontrado",
      "auth/wrong-password": "Contraseña incorrecta",
      "auth/invalid-email": "Correo inválido",
      "auth/invalid-credential": "Credenciales incorrectas"
    };
    showToast(msgs[e.code] || "Error de autenticación", "error");
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-sign-in-alt"></i> Ingresar';
  }
};

window.logoutAdmin = async function() {
  await signOut(auth);
  showToast("Sesión cerrada", "info");
};

// ── PANEL NAVIGATION ─────────────────────────────────────────
const panelTitles = {
  dashboard: "Dashboard", empresa: "Misión & Visión",
  valores: "Valores", "contacto-info": "Información de Contacto",
  portafolio: "Portafolio", servicios: "Servicios", citas: "Citas"
};

window.goPanel = function(id) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const panel = document.getElementById(`panel-${id}`);
  if (panel) panel.classList.add("active");
  const btn = document.querySelector(`[data-panel="${id}"]`);
  if (btn) btn.classList.add("active");
  document.getElementById("topbar-title").textContent = panelTitles[id] || id;
  // Lazy-load data when switching panels
  if (id === "empresa")       cargarEmpresaAdmin();
  if (id === "valores")       cargarValoresAdmin();
  if (id === "contacto-info") cargarContactoAdmin();
  if (id === "portafolio")    cargarPortafolioAdmin();
  if (id === "servicios")     cargarServiciosAdmin();
  if (id === "citas")         cargarCitas();
};

document.querySelectorAll(".nav-item[data-panel]").forEach(btn => {
  btn.addEventListener("click", () => goPanel(btn.dataset.panel));
});

window.toggleSidebar = function() {
  document.getElementById("sidebar").classList.toggle("open");
};

// ── INIT ─────────────────────────────────────────────────────
async function initAdmin() {
  await cargarDashboardStats();
}

// ── DASHBOARD STATS ──────────────────────────────────────────
async function cargarDashboardStats() {
  try {
    const [citasSnap, portSnap] = await Promise.all([
      getDocs(collection(db, "citas")),
      getDocs(collection(db, "portafolio"))
    ]);
    let total = 0, confirmadas = 0, pendientes = 0;
    citasSnap.forEach(d => {
      total++;
      const estado = d.data().estado;
      if (estado === "confirmada") confirmadas++;
      if (estado === "pendiente")  pendientes++;
    });
    document.getElementById("count-citas").textContent       = total;
    document.getElementById("count-confirmadas").textContent = confirmadas;
    document.getElementById("count-pendientes").textContent  = pendientes;
    document.getElementById("count-proyectos").textContent   = portSnap.size;
    if (pendientes > 0) {
      const badge = document.getElementById("citas-badge");
      badge.textContent = pendientes;
      badge.style.display = "inline";
    }
  } catch (e) {
    console.error("Error stats:", e);
  }
}

// ── EMPRESA: MISIÓN / VISIÓN ──────────────────────────────────
async function cargarEmpresaAdmin() {
  try {
    const snap = await getDoc(doc(db, "empresa", "info"));
    if (!snap.exists()) return;
    const d = snap.data();
    document.getElementById("e-mision").value      = d.mision      || "";
    document.getElementById("e-misionTitulo").value = d.misionTitulo || "";
    document.getElementById("e-vision").value      = d.vision      || "";
    document.getElementById("e-visionTitulo").value = d.visionTitulo || "";
    document.getElementById("e-heroDesc").value    = d.heroDesc     || "";
    document.getElementById("e-footerDesc").value  = d.footerDesc   || "";
  } catch (e) { console.error(e); }
}

window.guardarEmpresa = async function() {
  const data = {
    mision:       document.getElementById("e-mision").value.trim(),
    misionTitulo: document.getElementById("e-misionTitulo").value.trim(),
    vision:       document.getElementById("e-vision").value.trim(),
    visionTitulo: document.getElementById("e-visionTitulo").value.trim(),
    heroDesc:     document.getElementById("e-heroDesc").value.trim(),
    footerDesc:   document.getElementById("e-footerDesc").value.trim(),
  };
  if (!data.mision || !data.vision) {
    showToast("Misión y Visión son obligatorias", "error"); return;
  }
  try {
    await setDoc(doc(db, "empresa", "info"), data, { merge: true });
    showToast("Misión y Visión guardadas ✅", "success");
  } catch (e) {
    showToast("Error al guardar", "error"); console.error(e);
  }
};

// ── VALORES ──────────────────────────────────────────────────
async function cargarValoresAdmin() {
  const list = document.getElementById("valores-admin-list");
  try {
    const snap = await getDoc(doc(db, "empresa", "info"));
    const valores = snap.exists() ? (snap.data().valores || []) : [];
    valoresToSave = [...valores];
    renderValoresAdmin();
  } catch (e) { list.innerHTML = `<p class="caption">Error cargando valores</p>`; }
}

function renderValoresAdmin() {
  const list = document.getElementById("valores-admin-list");
  if (!valoresToSave.length) {
    list.innerHTML = `<div class="empty-state"><div class="icon">⭐</div><p>No hay valores agregados aún.</p></div>`;
    return;
  }
  list.innerHTML = valoresToSave.map((v, i) => `
    <div class="valor-row">
      <span class="v-icono">${v.icono || "⚡"}</span>
      <span class="v-nombre">${v.nombre}</span>
      <span class="v-desc">${v.descripcion || ""}</span>
      <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarValor(${i})" title="Eliminar">
        <i class="fa fa-trash"></i>
      </button>
    </div>
  `).join("");
}

window.agregarValor = async function() {
  const icono  = document.getElementById("v-icono").value.trim()  || "⚡";
  const nombre = document.getElementById("v-nombre").value.trim();
  const desc   = document.getElementById("v-desc").value.trim();
  if (!nombre) { showToast("Ingresa el nombre del valor", "error"); return; }
  valoresToSave.push({ icono, nombre, descripcion: desc });
  await setDoc(doc(db, "empresa", "info"), { valores: valoresToSave }, { merge: true });
  document.getElementById("v-icono").value  = "";
  document.getElementById("v-nombre").value = "";
  document.getElementById("v-desc").value   = "";
  renderValoresAdmin();
  showToast("Valor agregado ✅", "success");
};

window.eliminarValor = async function(i) {
  valoresToSave.splice(i, 1);
  await setDoc(doc(db, "empresa", "info"), { valores: valoresToSave }, { merge: true });
  renderValoresAdmin();
  showToast("Valor eliminado", "info");
};

// ── CONTACTO INFO ─────────────────────────────────────────────
async function cargarContactoAdmin() {
  try {
    const snap = await getDoc(doc(db, "empresa", "info"));
    if (!snap.exists()) return;
    const d = snap.data();
    document.getElementById("c-whatsapp").value = d.whatsapp || "";
    document.getElementById("c-email").value    = d.email    || "";
    document.getElementById("c-ciudad").value   = d.ciudad   || "";
  } catch (e) { console.error(e); }
}

window.guardarContacto = async function() {
  const data = {
    whatsapp: document.getElementById("c-whatsapp").value.trim(),
    email:    document.getElementById("c-email").value.trim(),
    ciudad:   document.getElementById("c-ciudad").value.trim(),
  };
  try {
    await setDoc(doc(db, "empresa", "info"), data, { merge: true });
    showToast("Información de contacto guardada ✅", "success");
  } catch (e) {
    showToast("Error al guardar", "error"); console.error(e);
  }
};

// ── PORTAFOLIO ────────────────────────────────────────────────
async function cargarPortafolioAdmin() {
  const list = document.getElementById("portafolio-admin-list");
  list.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;
  try {
    const q    = query(collection(db, "portafolio"), orderBy("orden", "asc"));
    const snap = await getDocs(q);
    document.getElementById("count-port-badge").textContent = `${snap.size} proyectos`;
    if (snap.empty) {
      list.innerHTML = `<div class="empty-state"><div class="icon">🖥️</div><p>No hay proyectos aún.</p></div>`;
      return;
    }
    let html = "";
    snap.forEach(d => {
      const p = d.data();
      const tags = (p.tags || []).join(", ");
      html += `
        <div class="item-row">
          <div class="item-icon">${p.imagen ? `<img src="${p.imagen}" style="width:48px;height:38px;object-fit:cover;border-radius:6px">` : "🌐"}</div>
          <div class="item-body">
            <div class="item-name">${p.nombre}</div>
            <div class="item-meta">${p.descripcion || ""} ${tags ? `· ${tags}` : ""}</div>
          </div>
          ${p.url ? `<a href="${p.url}" target="_blank" class="btn btn-secondary btn-sm"><i class="fa fa-external-link-alt"></i></a>` : ""}
          <div class="item-actions">
            <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarProyecto('${d.id}')">
              <i class="fa fa-trash"></i>
            </button>
          </div>
        </div>`;
    });
    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Error al cargar.</p></div>`;
    console.error(e);
  }
}

window.agregarProyecto = async function() {
  const nombre = document.getElementById("p-nombre").value.trim();
  if (!nombre) { showToast("El nombre del proyecto es obligatorio", "error"); return; }
  const tagsRaw = document.getElementById("p-tags").value.trim();
  const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];
  const data = {
    nombre,
    descripcion: document.getElementById("p-desc").value.trim(),
    url:         document.getElementById("p-url").value.trim(),
    imagen:      document.getElementById("p-imagen").value.trim(),
    tags,
    orden: parseInt(document.getElementById("p-orden").value) || 99,
    creadoEn: Timestamp.now()
  };
  try {
    await addDoc(collection(db, "portafolio"), data);
    showToast("Proyecto agregado al portafolio ✅", "success");
    ["p-nombre","p-desc","p-url","p-imagen","p-tags"].forEach(id => {
      document.getElementById(id).value = "";
    });
    cargarPortafolioAdmin();
    cargarDashboardStats();
  } catch (e) {
    showToast("Error al agregar proyecto", "error"); console.error(e);
  }
};

window.eliminarProyecto = async function(id) {
  if (!confirm("¿Eliminar este proyecto del portafolio?")) return;
  try {
    await deleteDoc(doc(db, "portafolio", id));
    showToast("Proyecto eliminado", "info");
    cargarPortafolioAdmin();
    cargarDashboardStats();
  } catch (e) {
    showToast("Error al eliminar", "error"); console.error(e);
  }
};

// ── SERVICIOS ─────────────────────────────────────────────────
async function cargarServiciosAdmin() {
  const list = document.getElementById("servicios-admin-list");
  list.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;
  try {
    const q    = query(collection(db, "servicios"), orderBy("orden", "asc"));
    const snap = await getDocs(q);
    document.getElementById("count-serv-badge").textContent = `${snap.size} servicios`;
    if (snap.empty) {
      list.innerHTML = `<div class="empty-state"><div class="icon">📦</div><p>No hay servicios aún.</p></div>`;
      return;
    }
    let html = "";
    snap.forEach(d => {
      const s = d.data();
      html += `
        <div class="item-row">
          <div class="item-icon">${s.icono || "🌐"}</div>
          <div class="item-body">
            <div class="item-name">${s.nombre}</div>
            <div class="item-meta">${s.descripcion || ""}</div>
          </div>
          ${s.precio ? `<span class="badge badge-accent">$${Number(s.precio).toLocaleString("es-CO")}</span>` : ""}
          <div class="item-actions">
            <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarServicio('${d.id}')">
              <i class="fa fa-trash"></i>
            </button>
          </div>
        </div>`;
    });
    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Error al cargar.</p></div>`;
    console.error(e);
  }
}

window.agregarServicio = async function() {
  const nombre = document.getElementById("s-nombre").value.trim();
  const desc   = document.getElementById("s-desc").value.trim();
  if (!nombre || !desc) { showToast("Nombre y descripción son obligatorios", "error"); return; }
  const data = {
    icono:       document.getElementById("s-icono").value.trim() || "🌐",
    nombre,
    descripcion: desc,
    precio:      parseFloat(document.getElementById("s-precio").value) || 0,
    orden:       parseInt(document.getElementById("s-orden").value) || 99,
    creadoEn:    Timestamp.now()
  };
  try {
    await addDoc(collection(db, "servicios"), data);
    showToast("Servicio agregado ✅", "success");
    ["s-icono","s-nombre","s-precio","s-desc"].forEach(id => {
      document.getElementById(id).value = "";
    });
    cargarServiciosAdmin();
  } catch (e) {
    showToast("Error al agregar servicio", "error"); console.error(e);
  }
};

window.eliminarServicio = async function(id) {
  if (!confirm("¿Eliminar este servicio?")) return;
  try {
    await deleteDoc(doc(db, "servicios", id));
    showToast("Servicio eliminado", "info");
    cargarServiciosAdmin();
  } catch (e) {
    showToast("Error al eliminar", "error"); console.error(e);
  }
};

// ── CITAS ─────────────────────────────────────────────────────
window.cargarCitas = async function() {
  const wrapper = document.getElementById("citas-table-wrapper");
  const filtro  = document.getElementById("filtro-estado").value;
  wrapper.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;
  try {
    let q;
    if (filtro) {
      q = query(collection(db, "citas"), where("estado", "==", filtro), orderBy("creadoEn", "desc"));
    } else {
      q = query(collection(db, "citas"), orderBy("creadoEn", "desc"));
    }
    const snap = await getDocs(q);
    if (snap.empty) {
      wrapper.innerHTML = `<div class="empty-state"><div class="icon">📅</div><p>No hay citas ${filtro ? `con estado "${filtro}"` : ""}.</p></div>`;
      return;
    }
    const estadoColors = {
      pendiente:  "badge-warning",
      confirmada: "badge-accent",
      completada: "badge-success",
      cancelada:  "badge-danger"
    };
    let rows = "";
    snap.forEach(d => {
      const c = d.data();
      const color = estadoColors[c.estado] || "badge-accent";
      rows += `
        <tr>
          <td>
            <div style="font-weight:600">${c.nombre}</div>
            <div class="caption">${c.email}</div>
          </td>
          <td>${c.telefono}</td>
          <td>
            <div>${c.fecha || "—"}</div>
            <div class="caption">${c.hora || ""}</div>
          </td>
          <td>${c.tipo || "—"}</td>
          <td>
            <select class="cita-estado-select" onchange="cambiarEstadoCita('${d.id}', this.value)">
              <option value="pendiente"  ${c.estado==="pendiente"  ? "selected":""}>Pendiente</option>
              <option value="confirmada" ${c.estado==="confirmada" ? "selected":""}>Confirmada</option>
              <option value="completada" ${c.estado==="completada" ? "selected":""}>Completada</option>
              <option value="cancelada"  ${c.estado==="cancelada"  ? "selected":""}>Cancelada</option>
            </select>
          </td>
          <td>
            <div class="caption" title="${c.mensaje || ''}">${(c.mensaje || "").slice(0,50)}${c.mensaje && c.mensaje.length>50?"...":""}</div>
          </td>
          <td>
            <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarCita('${d.id}')" title="Eliminar">
              <i class="fa fa-trash"></i>
            </button>
          </td>
        </tr>`;
    });
    wrapper.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Cliente</th><th>Teléfono</th><th>Fecha / Hora</th>
            <th>Tipo</th><th>Estado</th><th>Mensaje</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch (e) {
    wrapper.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Error al cargar citas.</p></div>`;
    console.error(e);
  }
};

window.cambiarEstadoCita = async function(id, estado) {
  try {
    await updateDoc(doc(db, "citas", id), { estado });
    showToast(`Estado actualizado: ${estado}`, "success");
    cargarDashboardStats();
  } catch (e) {
    showToast("Error al actualizar estado", "error"); console.error(e);
  }
};

window.eliminarCita = async function(id) {
  if (!confirm("¿Eliminar esta cita permanentemente?")) return;
  try {
    await deleteDoc(doc(db, "citas", id));
    showToast("Cita eliminada", "info");
    cargarCitas();
    cargarDashboardStats();
  } catch (e) {
    showToast("Error al eliminar", "error"); console.error(e);
  }
};
