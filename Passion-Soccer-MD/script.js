/* =========================================================
   PASSION SOCCER MD — script.js
   Lógica de: contador de 30 días, formulario de registro,
   modal de términos y utilidades de UX.

   BACKEND: los registros se guardan en Supabase (base de
   datos Postgres real, en la nube, con plan gratuito), no en
   localStorage. Esto significa que todos los registros de
   todos los usuarios —sin importar desde qué teléfono se
   registraron— quedan centralizados y tú los puedes ver desde
   admin.html estés donde estés.

   La conexión se arma con las credenciales de
   supabase-config.js (SUPABASE_URL y SUPABASE_ANON_KEY).
   La anon key es pública a propósito: la protección real vive
   en las políticas de Row Level Security (RLS) de la tabla
   "registrations", que solo permiten INSERT desde el público
   y SELECT (lectura) desde un usuario autenticado (el admin).

   El countdown sigue siendo local (localStorage): no es un
   dato sensible ni compartido, así que no necesita backend.
   ========================================================= */

(function () {
    "use strict";

    /* ---------------------------------------------------------
       0. CLIENTE DE SUPABASE
       --------------------------------------------------------- */
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
       1. CONTADOR DE 30 DÍAS
       --------------------------------------------------------- */
    const COUNTDOWN_KEY = "psmd_countdown_target";
    const COUNTDOWN_DAYS = 30;

    function getTargetDate() {
        const saved = localStorage.getItem(COUNTDOWN_KEY);

        if (saved) {
            const savedDate = new Date(saved);
            if (!isNaN(savedDate.getTime())) {
                return savedDate;
            }
        }

        // No existía fecha guardada (o estaba corrupta): creamos una nueva.
        const target = new Date();
        target.setDate(target.getDate() + COUNTDOWN_DAYS);
        localStorage.setItem(COUNTDOWN_KEY, target.toISOString());
        return target;
    }

    function renderCountdown() {
        const target = getTargetDate();
        const elDays = document.getElementById("days");
        const elHours = document.getElementById("hours");
        const elMinutes = document.getElementById("minutes");
        const elSeconds = document.getElementById("seconds");
        const board = document.getElementById("countdown");
        const finalMsg = document.getElementById("countdown-final");

        if (!elDays || !elHours || !elMinutes || !elSeconds) return;

        function tick() {
            const now = new Date();
            const diff = target.getTime() - now.getTime();

            if (diff <= 0) {
                board.hidden = true;
                finalMsg.hidden = false;
                clearInterval(timer);
                return;
            }

            const totalSeconds = Math.floor(diff / 1000);
            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            elDays.textContent = String(days).padStart(2, "0");
            elHours.textContent = String(hours).padStart(2, "0");
            elMinutes.textContent = String(minutes).padStart(2, "0");
            elSeconds.textContent = String(seconds).padStart(2, "0");
        }

        tick();
        const timer = setInterval(tick, 1000);
    }

    /* ---------------------------------------------------------
       2. FORMULARIO DE REGISTRO
       --------------------------------------------------------- */

    // Envía el registro a la tabla "registrations" en Supabase.
    // Devuelve una Promise que se resuelve si se guardó bien,
    // o se rechaza con un error si algo falló.
    async function saveRegistration(entry) {
        const client = getSupabaseClient();

        if (!client) {
            throw new Error(
                "La conexión con la base de datos no está configurada (revisa supabase-config.js)."
            );
        }

        const { error } = await client.from("registrations").insert([
            {
                name: entry.name,
                phone: entry.phone,
                email: entry.email,
                instagram: entry.instagram,
            },
        ]);

        if (error) {
            console.error("Error al guardar el registro en Supabase:", error);
            throw error;
        }
    }

    function isValidEmail(value) {
        if (!value) return true; // el correo es opcional
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function isValidPhone(value) {
        // Acepta dígitos, espacios, guiones y un + inicial. Mínimo 7 dígitos.
        const digitsOnly = value.replace(/\D/g, "");
        return digitsOnly.length >= 7;
    }

    function setFieldState(input, errorEl, message) {
        if (message) {
            input.classList.add("is-error");
            input.classList.remove("is-valid");
            errorEl.textContent = message;
            return false;
        }
        input.classList.remove("is-error");
        input.classList.add("is-valid");
        errorEl.textContent = "";
        return true;
    }

    function initSignupForm() {
        const form = document.getElementById("signup-form");
        if (!form) return;

        const nameInput = document.getElementById("name");
        const phoneInput = document.getElementById("phone");
        const emailInput = document.getElementById("email");
        const instagramInput = document.getElementById("instagram");
        const submitBtn = document.getElementById("submit-btn");
        const feedback = document.getElementById("form-feedback");

        const errorName = document.getElementById("error-name");
        const errorPhone = document.getElementById("error-phone");
        const errorEmail = document.getElementById("error-email");

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            feedback.textContent = "";
            feedback.className = "signup__feedback";

            const name = nameInput.value.trim();
            const phone = phoneInput.value.trim();
            const email = emailInput.value.trim();
            const instagram = instagramInput.value.trim().replace(/^@/, "");

            const validName = setFieldState(
                nameInput,
                errorName,
                name.length < 2 ? "Cuéntanos tu nombre completo." : ""
            );

            const validPhone = setFieldState(
                phoneInput,
                errorPhone,
                !isValidPhone(phone) ? "Necesitamos un teléfono válido para contactarte." : ""
            );

            const validEmail = setFieldState(
                emailInput,
                errorEmail,
                !isValidEmail(email) ? "Ese correo no se ve válido, revísalo." : ""
            );

            if (!validName || !validPhone || !validEmail) {
                feedback.textContent = "Por favor completa los campos obligatorios.";
                feedback.classList.add("error");
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = "Guardando...";

            const entry = {
                name,
                phone,
                email: email || null,
                instagram: instagram || null,
            };

            try {
                // Guarda el registro en Supabase (base de datos real en la nube).
                await saveRegistration(entry);

                feedback.textContent = "¡Listo! Te avisaremos apenas lancemos todo.";
                feedback.classList.add("success");
                form.reset();
                [nameInput, phoneInput, emailInput].forEach((input) => {
                    input.classList.remove("is-valid", "is-error");
                });
            } catch (err) {
                feedback.textContent =
                    "Algo falló al guardar tu registro. Intenta de nuevo en un momento.";
                feedback.classList.add("error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Quiero estar dentro";
            }
        });

        // Limpia el estado de error apenas el usuario empieza a corregir.
        [nameInput, phoneInput, emailInput].forEach((input) => {
            input.addEventListener("input", function () {
                if (input.classList.contains("is-error")) {
                    input.classList.remove("is-error");
                }
            });
        });
    }

    /* ---------------------------------------------------------
       3. MODAL DE TÉRMINOS Y CONDICIONES
       --------------------------------------------------------- */
    function initTermsModal() {
        const modal = document.getElementById("terms-modal");
        const openers = [
            document.getElementById("open-terms"),
            document.getElementById("open-terms-footer"),
        ].filter(Boolean);
        const closers = modal ? modal.querySelectorAll("[data-close-modal]") : [];

        if (!modal || openers.length === 0) return;

        function openModal() {
            modal.hidden = false;
            document.body.style.overflow = "hidden";
        }

        function closeModal() {
            modal.hidden = true;
            document.body.style.overflow = "";
        }

        openers.forEach((btn) => btn.addEventListener("click", openModal));
        closers.forEach((el) => el.addEventListener("click", closeModal));

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !modal.hidden) closeModal();
        });
    }

    /* ---------------------------------------------------------
       4. UTILIDADES VARIAS
       --------------------------------------------------------- */
    function setDynamicYear() {
        const yearEl = document.getElementById("year");
        if (yearEl) yearEl.textContent = new Date().getFullYear();
    }

    /* ---------------------------------------------------------
       INIT
       --------------------------------------------------------- */
    document.addEventListener("DOMContentLoaded", function () {
        renderCountdown();
        initSignupForm();
        initTermsModal();
        setDynamicYear();
    });
})();