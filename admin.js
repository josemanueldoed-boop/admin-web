// ============================================================
//  admin.js — CreatorWeb | Panel Administrativo
//  Google Auth + Firestore CRUD completo
//  Sistema de admins: correo maestro fijo + colección admins
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signOut, onAuthStateChanged
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

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();

// ── CORREO MAESTRO FIJO ──────────────────────────────────────
// Cambia esto por tu correo de Google principal.
// Este correo siempre tendrá acceso sin importar lo que haya en Firestore.
const MASTER_ADMIN_EMAIL = "tucorreo@gmail.com";

// ── Global state ─────────────────────────────────────────────
let currentUser   = null;
let valoresToSave = [];

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

function formatTimestamp(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

const googleIconSVG = `
  <svg class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
  Continuar con Google`;

// ── VERIFICAR SI ES ADMIN ────────────────────────────────────
async function esAdmin(email) {
  if (!email) return false;
  if (email === MASTER_ADMIN_EMAIL) return true;
  try {
    const snap = await getDoc(doc(db, "admins", email));
    return snap.exists() && snap.data().activo === true;
  } catch (e) {
    console.error("Error verificando admin:", e);
    return false;
  }
}

// ── AUTH: GOOGLE LOGIN ───────────────────────────────────────
window.loginConGoogle = async function() {
  const btn    = document.getElementById("btn-google-login");
  const denied = document.getElementById("access-denied");
  denied.style.display = "none";
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="border-color:rgba(0,0,0,0.15);border-top-color:#4285F4"></span> Verificando...`;

  try {
    const result = await signInWithPopup(auth, provider);
    const ok     = await esAdmin(result.user.email);
    if (!ok) {
      await signOut(auth);
      denied.style.display = "block";
      btn.disabled = false;
      btn.innerHTML = googleIconSVG;
    }
    // Si ok, onAuthStateChanged abre el panel automáticamente
  } catch (e) {
    if (e.code !== "auth/popup-closed-by-user") {
      showToast("Error al iniciar sesión con Google", "error");
      console.error(e);
    }
    btn.disabled = false;
    btn.innerHTML = googleIconSVG;
  }
};

onAuthStateChanged(auth, async user => {
  if (user) {
    const ok = await esAdmin(user.email);
    if (!ok) { await signOut(auth); return; }

    currentUser = user;
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("admin-app").style.display    = "flex";

    const avatarEl = document.getElementById("user-avatar");
    if (user.photoURL) {
      avatarEl.innerHTML = `<img src="${user.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
    } else {
      avatarEl.textContent = (user.displayName || user.email || "A")[0].toUpperCase();
    }
    document.getElementById("user-name").textContent = user.displayName || user.email;
    initAdmin();
  } else {
    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("admin-app").style.display    = "none";
  }
});

window.logoutAdmin = async function() {
  await signOut(auth);
  showToast("Sesión cerrada correctamente", "info");
};

// ── PANEL NAVIGATION ─────────────────────────────────────────
const panelTitles = {
  dashboard: "Dashboard", empresa: "Misión & Visión",
  valores: "Valores", "contacto-info": "Información de Contacto",
  portafolio: "Portafolio", servicios: "Servicios",
  citas: "Citas", admins: "Administradores"
};

window.goPanel = function(id) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const panel = document.getElementById(`panel-${id}`);
  if (panel) panel.classList.add("active");
  const btn = document.querySelector(`[data-panel="${id}"]`);
  if (btn) btn.classList.add("active");
  document.getElementById("topbar-title").textContent = panelTitles[id] || id;
  if (id === "empresa")       cargarEmpresaAdmin();
  if (id === "valores")       cargarValoresAdmin();
  if (id === "contacto-info") cargarContactoAdmin();
  if (id === "portafolio")    cargarPortafolioAdmin();
  if (id === "servicios")     cargarServiciosAdmin();
  if (id === "citas")         cargarCitas();
  if (id === "admins")        cargarAdmins();
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
  const el = document.getElementById("master-admin-display");
  if (el) el.textContent = MASTER_ADMIN_EMAIL;
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
  } catch (e) { console.error("Error stats:", e); }
}

// ── EMPRESA ───────────────────────────────────────────────────
async function cargarEmpresaAdmin() {
  try {
    const snap = await getDoc(doc(db, "empresa", "info"));
    if (!snap.exists()) return;
    const d = snap.data();
    document.getElementById("e-mision").value       = d.mision       || "";
    document.getElementById("e-misionTitulo").value  = d.misionTitulo || "";
    document.getElementById("e-vision").value        = d.vision       || "";
    document.getElementById("e-visionTitulo").value  = d.visionTitulo || "";
    document.getElementById("e-heroDesc").value      = d.heroDesc     || "";
    document.getElementById("e-footerDesc").value    = d.footerDesc   || "";
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
    showToast("Guardado correctamente ✅", "success");
  } catch (e) {
    showToast("Error al guardar", "error"); console.error(e);
  }
};

// ── VALORES ──────────────────────────────────────────────────
async function cargarValoresAdmin() {
  try {
    const snap = await getDoc(doc(db, "empresa", "info"));
    valoresToSave = snap.exists() ? (snap.data().valores || []) : [];
    renderValoresAdmin();
  } catch (e) { console.error(e); }
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
      <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarValor(${i})">
        <i class="fa fa-trash"></i>
      </button>
    </div>`).join("");
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

// ── CONTACTO ──────────────────────────────────────────────────
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
    showToast("Contacto guardado ✅", "success");
  } catch (e) {
    showToast("Error al guardar", "error"); console.error(e);
  }
};

// ── PORTAFOLIO ────────────────────────────────────────────────
async function cargarPortafolioAdmin() {
  const list = document.getElementById("portafolio-admin-list");
  list.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;
  try {
    const snap = await getDocs(query(collection(db, "portafolio"), orderBy("orden","asc")));
    document.getElementById("count-port-badge").textContent = `${snap.size} proyectos`;
    if (snap.empty) {
      list.innerHTML = `<div class="empty-state"><div class="icon">🖥️</div><p>No hay proyectos aún.</p></div>`;
      return;
    }
    let html = "";
    snap.forEach(d => {
      const p = d.data();
      html += `
        <div class="item-row">
          <div class="item-icon">${p.imagen
            ? `<img src="${p.imagen}" style="width:48px;height:38px;object-fit:cover;border-radius:6px">`
            : "🌐"}</div>
          <div class="item-body">
            <div class="item-name">${p.nombre}</div>
            <div class="item-meta">${p.descripcion || ""} ${(p.tags||[]).join(", ") ? `· ${(p.tags||[]).join(", ")}` : ""}</div>
          </div>
          ${p.url ? `<a href="${p.url}" target="_blank" class="btn btn-secondary btn-sm"><i class="fa fa-external-link-alt"></i></a>` : ""}
          <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarProyecto('${d.id}')">
            <i class="fa fa-trash"></i>
          </button>
        </div>`;
    });
    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Error al cargar.</p></div>`;
  }
}

window.agregarProyecto = async function() {
  const nombre = document.getElementById("p-nombre").value.trim();
  if (!nombre) { showToast("El nombre es obligatorio", "error"); return; }
  const tagsRaw = document.getElementById("p-tags").value.trim();
  const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];
  try {
    await addDoc(collection(db, "portafolio"), {
      nombre,
      descripcion: document.getElementById("p-desc").value.trim(),
      url:         document.getElementById("p-url").value.trim(),
      imagen:      document.getElementById("p-imagen").value.trim(),
      tags, orden: parseInt(document.getElementById("p-orden").value) || 99,
      creadoEn: Timestamp.now()
    });
    showToast("Proyecto agregado ✅", "success");
    ["p-nombre","p-desc","p-url","p-imagen","p-tags"].forEach(id => document.getElementById(id).value = "");
    cargarPortafolioAdmin(); cargarDashboardStats();
  } catch (e) { showToast("Error al agregar", "error"); console.error(e); }
};

window.eliminarProyecto = async function(id) {
  if (!confirm("¿Eliminar este proyecto?")) return;
  try {
    await deleteDoc(doc(db, "portafolio", id));
    showToast("Proyecto eliminado", "info");
    cargarPortafolioAdmin(); cargarDashboardStats();
  } catch (e) { showToast("Error al eliminar", "error"); }
};

// ── SERVICIOS ─────────────────────────────────────────────────
async function cargarServiciosAdmin() {
  const list = document.getElementById("servicios-admin-list");
  list.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;
  try {
    const snap = await getDocs(query(collection(db, "servicios"), orderBy("orden","asc")));
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
          <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarServicio('${d.id}')">
            <i class="fa fa-trash"></i>
          </button>
        </div>`;
    });
    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Error al cargar.</p></div>`;
  }
}

window.agregarServicio = async function() {
  const nombre = document.getElementById("s-nombre").value.trim();
  const desc   = document.getElementById("s-desc").value.trim();
  if (!nombre || !desc) { showToast("Nombre y descripción son obligatorios", "error"); return; }
  try {
    await addDoc(collection(db, "servicios"), {
      icono:       document.getElementById("s-icono").value.trim() || "🌐",
      nombre, descripcion: desc,
      precio:   parseFloat(document.getElementById("s-precio").value) || 0,
      orden:    parseInt(document.getElementById("s-orden").value) || 99,
      creadoEn: Timestamp.now()
    });
    showToast("Servicio agregado ✅", "success");
    ["s-icono","s-nombre","s-precio","s-desc"].forEach(id => document.getElementById(id).value = "");
    cargarServiciosAdmin();
  } catch (e) { showToast("Error al agregar", "error"); console.error(e); }
};

window.eliminarServicio = async function(id) {
  if (!confirm("¿Eliminar este servicio?")) return;
  try {
    await deleteDoc(doc(db, "servicios", id));
    showToast("Servicio eliminado", "info");
    cargarServiciosAdmin();
  } catch (e) { showToast("Error al eliminar", "error"); }
};

// ── CITAS ─────────────────────────────────────────────────────
window.cargarCitas = async function() {
  const wrapper = document.getElementById("citas-table-wrapper");
  const filtro  = document.getElementById("filtro-estado").value;
  wrapper.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;
  try {
    let q = filtro
      ? query(collection(db,"citas"), where("estado","==",filtro), orderBy("creadoEn","desc"))
      : query(collection(db,"citas"), orderBy("creadoEn","desc"));
    const snap = await getDocs(q);
    if (snap.empty) {
      wrapper.innerHTML = `<div class="empty-state"><div class="icon">📅</div><p>No hay citas.</p></div>`;
      return;
    }
    let rows = "";
    snap.forEach(d => {
      const c = d.data();
      rows += `
        <tr>
          <td><div style="font-weight:600">${c.nombre}</div><div class="caption">${c.email}</div></td>
          <td>${c.telefono}</td>
          <td><div>${c.fecha||"—"}</div><div class="caption">${c.hora||""}</div></td>
          <td>${c.tipo||"—"}</td>
          <td>
            <select class="cita-estado-select" onchange="cambiarEstadoCita('${d.id}',this.value)">
              <option value="pendiente"  ${c.estado==="pendiente" ?"selected":""}>Pendiente</option>
              <option value="confirmada" ${c.estado==="confirmada"?"selected":""}>Confirmada</option>
              <option value="completada" ${c.estado==="completada"?"selected":""}>Completada</option>
              <option value="cancelada"  ${c.estado==="cancelada" ?"selected":""}>Cancelada</option>
            </select>
          </td>
          <td><div class="caption">${(c.mensaje||"").slice(0,50)}${c.mensaje&&c.mensaje.length>50?"...":""}</div></td>
          <td><button class="btn btn-danger btn-sm btn-icon" onclick="eliminarCita('${d.id}')"><i class="fa fa-trash"></i></button></td>
        </tr>`;
    });
    wrapper.innerHTML = `
      <table>
        <thead><tr><th>Cliente</th><th>Teléfono</th><th>Fecha/Hora</th><th>Tipo</th><th>Estado</th><th>Mensaje</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch (e) {
    wrapper.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Error al cargar.</p></div>`;
    console.error(e);
  }
};

window.cambiarEstadoCita = async function(id, estado) {
  try {
    await updateDoc(doc(db, "citas", id), { estado });
    showToast(`Estado: ${estado}`, "success");
    cargarDashboardStats();
  } catch (e) { showToast("Error al actualizar", "error"); }
};

window.eliminarCita = async function(id) {
  if (!confirm("¿Eliminar esta cita?")) return;
  try {
    await deleteDoc(doc(db, "citas", id));
    showToast("Cita eliminada", "info");
    cargarCitas(); cargarDashboardStats();
  } catch (e) { showToast("Error al eliminar", "error"); }
};

// ── ADMINISTRADORES ───────────────────────────────────────────
async function cargarAdmins() {
  const list = document.getElementById("admins-list");
  list.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;
  const masterEl = document.getElementById("master-admin-display");
  if (masterEl) masterEl.textContent = MASTER_ADMIN_EMAIL;
  try {
    const snap = await getDocs(collection(db, "admins"));
    document.getElementById("count-admins-badge").textContent = `${snap.size} admins`;
    if (snap.empty) {
      list.innerHTML = `<div class="empty-state"><div class="icon">👥</div><p>No hay admins adicionales aún.</p></div>`;
      return;
    }
    let html = "";
    snap.forEach(d => {
      const a = d.data();
      const esMaster = d.id === MASTER_ADMIN_EMAIL;
      html += `
        <div class="item-row">
          <div class="item-icon">${a.foto
            ? `<img src="${a.foto}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`
            : "👤"}</div>
          <div class="item-body">
            <div class="item-name">${a.nombre || d.id}</div>
            <div class="item-meta">${d.id} · Agregado: ${formatTimestamp(a.creadoEn)}</div>
          </div>
          <span class="badge ${a.activo ? 'badge-success':'badge-danger'}">${a.activo ? 'Activo':'Inactivo'}</span>
          ${esMaster
            ? `<span class="badge badge-warning">Master</span>`
            : `<button class="btn btn-secondary btn-sm" onclick="toggleAdmin('${d.id}',${!a.activo})" title="${a.activo?'Desactivar':'Activar'}">
                <i class="fa fa-${a.activo?'pause':'play'}"></i>
               </button>
               <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarAdmin('${d.id}')">
                <i class="fa fa-trash"></i>
               </button>`}
        </div>`;
    });
    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Error al cargar admins.</p></div>`;
    console.error(e);
  }
}

window.agregarAdmin = async function() {
  const email = document.getElementById("adm-email").value.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    showToast("Ingresa un correo válido", "error"); return;
  }
  if (email === MASTER_ADMIN_EMAIL) {
    showToast("Ese correo ya es el admin principal", "warning"); return;
  }
  try {
    const existe = await getDoc(doc(db, "admins", email));
    if (existe.exists()) { showToast("Ese correo ya existe", "warning"); return; }
    await setDoc(doc(db, "admins", email), {
      nombre:    email.split("@")[0],
      activo:    true,
      creadoEn:  Timestamp.now(),
      creadoPor: currentUser?.email || "sistema"
    });
    document.getElementById("adm-email").value = "";
    showToast(`Admin ${email} agregado ✅`, "success");
    cargarAdmins();
  } catch (e) { showToast("Error al agregar admin", "error"); console.error(e); }
};

window.toggleAdmin = async function(email, nuevoEstado) {
  try {
    await updateDoc(doc(db, "admins", email), { activo: nuevoEstado });
    showToast(`Admin ${nuevoEstado ? "activado":"desactivado"}`, "info");
    cargarAdmins();
  } catch (e) { showToast("Error al actualizar", "error"); }
};

window.eliminarAdmin = async function(email) {
  if (email === MASTER_ADMIN_EMAIL) {
    showToast("No puedes eliminar al admin principal", "error"); return;
  }
  if (!confirm(`¿Eliminar a ${email} como administrador?`)) return;
  try {
    await deleteDoc(doc(db, "admins", email));
    showToast("Admin eliminado", "info");
    cargarAdmins();
  } catch (e) { showToast("Error al eliminar", "error"); }
};
