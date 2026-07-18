/* =========================================================
   PASSION SOCCER MD — admin.js
   Login real con Supabase Auth + panel de registros leídos
   desde la base de datos (tabla "registrations").

   CÓMO FUNCIONA LA SEGURIDAD AQUÍ:
   - El login usa Supabase Auth: solo entra quien tenga un
     usuario creado por ti en el dashboard de Supabase
     (Authentication → Users → Add user). No hay contraseñas
     escritas en este archivo.
   - La tabla "registrations" tiene Row Level Security (RLS)
     activado con dos políticas:
       1. Cualquiera puede INSERTAR (para que el formulario
          público funcione sin necesitar login).
       2. Solo un usuario AUTENTICADO puede LEER (SELECT) los
          registros. Por eso, sin haber iniciado sesión, este
          panel no puede traer ningún dato aunque alguien
          copie la anon key del código fuente.
   - La sesión de Supabase se guarda de forma segura por su
     propio SDK (tokens con expiración), no es un simple
     "true"/"false" editable en localStorage.
   ========================================================= */

(function () {
    "use strict";

    const TABLE_NAME = "registrations";

    const loginView = document.getElementById("login-view");
    const panelView = document.getElementById("panel-view");

    let supabaseClient = null;

    function getSupabaseClient() {
        if (supabaseClient) return supabaseClient;

        if (typeof SUPABASE_URL === "undefined" || SUPABASE_URL.includes("PEGA_AQUI")) {
            console.error(
                "Supabase no está configurado todavía: edita supabase-config.js con tu URL y anon key."
            );
            return null;
        }

        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return supabaseClient;
    }

    /* ---------------------------------------------------------
       SESIÓN
       --------------------------------------------------------- */
    function showLogin() {
        loginView.hidden = false;
        panelView.hidden = true;
    }

    function showPanel() {
        loginView.hidden = true;
        panelView.hidden = false;
        renderRegistrations();
    }

    async function checkExistingSession() {
        const client = getSupabaseClient();
        if (!client) return showLogin();

        const { data } = await client.auth.getSession();
        if (data && data.session) {
            showPanel();
        } else {
            showLogin();
        }
    }

    /* ---------------------------------------------------------
       LOGIN FORM
       --------------------------------------------------------- */
    function initLoginForm() {
        const form = document.getElementById("login-form");
        const emailInput = document.getElementById("admin-email");
        const passwordInput = document.getElementById("admin-password");
        const submitBtn = document.getElementById("login-submit");
        const errorEl = document.getElementById("login-error");

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            errorEl.textContent = "";

            const client = getSupabaseClient();
            if (!client) {
                errorEl.textContent = "La conexión con la base de datos no está configurada.";
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = "Entrando...";

            const { error } = await client.auth.signInWithPassword({
                email: emailInput.value.trim(),
                password: passwordInput.value,
            });

            submitBtn.disabled = false;
            submitBtn.textContent = "Entrar";

            if (error) {
                errorEl.textContent = "Correo o contraseña incorrectos.";
                passwordInput.classList.add("is-error");
                passwordInput.focus();
                return;
            }

            passwordInput.value = "";
            showPanel();
        });

        [emailInput, passwordInput].forEach((input) => {
            input.addEventListener("input", function () {
                errorEl.textContent = "";
                passwordInput.classList.remove("is-error");
            });
        });
    }

    async function logout() {
        const client = getSupabaseClient();
        if (client) await client.auth.signOut();
        showLogin();
    }

    /* ---------------------------------------------------------
       REGISTROS: lectura desde Supabase, render tabla/tarjetas,
       export CSV
       --------------------------------------------------------- */
    async function fetchRegistrations() {
        const client = getSupabaseClient();
        if (!client) return [];

        const { data, error } = await client
            .from(TABLE_NAME)
            .select("id, created_at, name, phone, email, instagram")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error al leer los registros:", error);
            return [];
        }

        return data || [];
    }

    function formatDate(isoString) {
        try {
            const date = new Date(isoString);
            return date.toLocaleString("es-VE", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch (e) {
            return isoString;
        }
    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value == null ? "" : String(value);
        return div.innerHTML;
    }

    async function renderRegistrations() {
        const countEl = document.getElementById("registrations-count");
        const emptyEl = document.getElementById("panel-empty");
        const tableWrap = document.getElementById("table-wrap");
        const cardsWrap = document.getElementById("cards-wrap");
        const tbody = document.getElementById("registrations-tbody");

        countEl.textContent = "Cargando...";

        const registrations = await fetchRegistrations();

        countEl.textContent =
            registrations.length === 1
                ? "1 registro"
                : `${registrations.length} registros`;

        if (registrations.length === 0) {
            emptyEl.hidden = false;
            tableWrap.hidden = true;
            cardsWrap.hidden = true;
            return;
        }

        emptyEl.hidden = true;

        // Elegimos tabla o tarjetas según el ancho de pantalla actual.
        const useTable = window.matchMedia("(min-width: 720px)").matches;
        tableWrap.hidden = !useTable;
        cardsWrap.hidden = useTable;

        // --- Tabla ---
        tbody.innerHTML = registrations
            .map(
                (r) => `
        <tr>
          <td class="muted">${escapeHtml(formatDate(r.created_at))}</td>
          <td>${escapeHtml(r.name)}</td>
          <td>${escapeHtml(r.phone)}</td>
          <td class="muted">${escapeHtml(r.email) || "—"}</td>
          <td class="muted">${r.instagram ? "@" + escapeHtml(r.instagram) : "—"}</td>
        </tr>`
            )
            .join("");

        // --- Tarjetas ---
        cardsWrap.innerHTML = registrations
            .map(
                (r) => `
        <div class="reg-card">
          <p class="reg-card__date">${escapeHtml(formatDate(r.created_at))}</p>
          <div class="reg-card__row">
            <span class="reg-card__label">Nombre</span>
            <span class="reg-card__value">${escapeHtml(r.name)}</span>
          </div>
          <div class="reg-card__row">
            <span class="reg-card__label">Teléfono</span>
            <span class="reg-card__value">${escapeHtml(r.phone)}</span>
          </div>
          <div class="reg-card__row">
            <span class="reg-card__label">Correo</span>
            <span class="reg-card__value">${escapeHtml(r.email) || "—"}</span>
          </div>
          <div class="reg-card__row">
            <span class="reg-card__label">Instagram</span>
            <span class="reg-card__value">${r.instagram ? "@" + escapeHtml(r.instagram) : "—"}</span>
          </div>
        </div>`
            )
            .join("");
    }

    async function exportToCsv() {
        const registrations = await fetchRegistrations();

        if (registrations.length === 0) {
            alert("No hay registros para exportar todavía.");
            return;
        }

        const headers = ["Fecha", "Nombre", "Teléfono", "Correo", "Instagram"];
        const rows = registrations.map((r) => [
            formatDate(r.created_at),
            r.name || "",
            r.phone || "",
            r.email || "",
            r.instagram ? `@${r.instagram}` : "",
        ]);

        const csvContent = [headers, ...rows]
            .map((row) =>
                row
                    .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
                    .join(",")
            )
            .join("\r\n");

        // BOM para que Excel abra bien los acentos en UTF-8.
        const blob = new Blob(["\uFEFF" + csvContent], {
            type: "text/csv;charset=utf-8;",
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const today = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `passion-soccer-md-registros-${today}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /* ---------------------------------------------------------
       INIT
       --------------------------------------------------------- */
    document.addEventListener("DOMContentLoaded", function () {
        initLoginForm();

        document.getElementById("logout-btn").addEventListener("click", logout);
        document.getElementById("refresh-btn").addEventListener("click", renderRegistrations);
        document.getElementById("export-btn").addEventListener("click", exportToCsv);

        window.addEventListener("resize", function () {
            if (!panelView.hidden) renderRegistrations();
        });

        checkExistingSession();
    });
})();