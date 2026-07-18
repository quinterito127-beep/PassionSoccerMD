-- =========================================================
-- PASSION SOCCER MD — supabase-setup.sql
-- ---------------------------------------------------------
-- Copia TODO este archivo y pégalo en:
-- tu proyecto de Supabase → SQL Editor → New query → Run
-- =========================================================

-- 1. Tabla de registros
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  email text,
  instagram text
);

-- 2. Activamos Row Level Security (sin esto, por defecto Supabase
--    bloquea todo; con las políticas de abajo abrimos solo lo justo).
alter table public.registrations enable row level security;

-- 3. Política: cualquier visitante (rol "anon") puede INSERTAR
--    un registro. Esto es lo que necesita el formulario público.
create policy "Cualquiera puede registrarse"
  on public.registrations
  for insert
  to anon
  with check (true);

-- 4. Política: solo un usuario autenticado (tú, el admin, después
--    de iniciar sesión) puede LEER los registros. El público NO
--    puede leer esta tabla aunque tenga la anon key.
create policy "Solo el admin autenticado puede leer"
  on public.registrations
  for select
  to authenticated
  using (true);

-- Listo. Después de correr esto, ve a Authentication → Users → Add user
-- para crear tu propio correo y contraseña de administrador.