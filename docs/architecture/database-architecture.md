# Database Architecture & Data Model: ActivaCore

> 🗄️ Master Database Architecture Document · Living Data Blueprint
> 🔄 Last Updated: 2026-10-13 · Status: Active / Production Scheme Certified
> 👤 Data Authority: Dirección de Tecnología & Finanzas (UNAPEC)
> 🐘 Engine: PostgreSQL 16 (Port 5433 / AWS RDS Multi-AZ) · ORM: Prisma 6.19
> ⚠️ **MANDATORY QUALITY GATE (Hard Gate 12)**: Este documento detalla exhaustivamente el DDL físico, tipos SQL exactos, restricciones, índices B-Tree y protocolos de migración determinista.

---

## 1. Engine Specifications & Connection Architecture

### 1.1 Server & Instance Configuration
- **Motor y Versión**: PostgreSQL 16.x (Contenedor Docker ctivacore-postgres / AWS RDS).
- **Codificación Primaria**: UTF-8 · Collation: en_US.UTF-8.
- **Zona Horaria**: UTC (Todas las fechas y timestamps se almacenan estrictamente en UTC).
- **Extensiones Activas**:
  - uuid-ossp / pgcrypto: Generación criptográfica nativa de UUIDv4 (gen_random_uuid()).

### 1.2 Connection Pooling & Client Strategy
- **Cliente ORM**: Prisma ORM 6.19 (@prisma/client) configurado como singleton global en pp/lib/prisma.ts.
- **Límites de Pool**:
  - connection_limit: 10 conexiones simultáneas por instancia de aplicación.
  - pool_timeout: 10 segundos.
  - connect_timeout: 5 segundos.
- **Cadena de Conexión**: Parametrizada vía variable de entorno DATABASE_URL en .env (no versionada).

---

## 2. Master Entity-Relationship Diagram (Global RBAC ERD)

```mermaid
erDiagram
    roles ||--o{ roles_permisos : asigna
    permisos ||--o{ roles_permisos : contiene
    roles ||--o{ usuarios : clasifica
    usuarios ||--o{ password_reset_tokens : emite

    roles {
        uuid id PK
        string codigo UK
        string nombre
        string descripcion
        boolean es_sistema
        string estado
        timestamptz created_at
        timestamptz updated_at
    }

    permisos {
        uuid id PK
        string codigo UK
        string modulo
        string descripcion
        timestamptz created_at
    }

    roles_permisos {
        uuid id PK
        uuid rol_id FK
        uuid permiso_id FK
        timestamptz created_at
    }

    usuarios {
        uuid id PK
        string nombre
        string correo UK
        string password_hash
        uuid rol_id FK
        string empleado_id
        string estado
        timestamptz ultimo_login_at
        timestamptz created_at
        timestamptz updated_at
    }

    password_reset_tokens {
        uuid id PK
        uuid usuario_id FK
        string token_hash UK
        timestamptz expires_at
        timestamptz used_at
        string ip_address
        string user_agent
        timestamptz created_at
    }
```

---
## 3. Physical Schema DDL & Data Dictionary

### 3.1 DDL Statements (PostgreSQL 16 Dialect)
```sql
-- 1. Tabla: roles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    es_sistema BOOLEAN NOT NULL DEFAULT false,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_roles_codigo UNIQUE (codigo)
);

-- 2. Tabla: permisos
CREATE TABLE permisos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL,
    modulo VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_permisos_codigo UNIQUE (codigo)
);

-- 3. Tabla relacional: roles_permisos
CREATE TABLE roles_permisos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rol_id UUID NOT NULL,
    permiso_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_roles_permisos_rol FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_roles_permisos_permiso FOREIGN KEY (permiso_id) REFERENCES permisos(id) ON DELETE CASCADE,
    CONSTRAINT uq_roles_permisos_rol_permiso UNIQUE (rol_id, permiso_id)
);

-- 4. Tabla: usuarios
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol_id UUID NOT NULL,
    empleado_id VARCHAR(50),
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    ultimo_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE RESTRICT,
    CONSTRAINT uq_usuarios_correo UNIQUE (correo)
);

-- 5. Tabla: password_reset_tokens
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tokens_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT uq_tokens_token_hash UNIQUE (token_hash)
);
```

---

## 4. Indexing & Performance Strategy

| Index Name | Table | Columns | Type | Purpose |
|------------|-------|---------|------|---------|
| idx_usuarios_correo | usuarios | correo | B-Tree (Unique) | Búsqueda O(1) en autenticación institucional. |
| idx_usuarios_rol_id | usuarios | rol_id | B-Tree | Optimización de joins con catálogo de roles. |
| idx_roles_codigo | roles | codigo | B-Tree (Unique) | Resolución de roles base del sistema. |
| idx_permisos_codigo | permisos | codigo | B-Tree (Unique) | Resolución de verificador RBAC. |
| idx_roles_permisos_lookup | roles_permisos | (rol_id, permiso_id) | B-Tree (Composite) | Resolución instantánea de capacidades en login. |
| idx_tokens_token_hash | password_reset_tokens | token_hash | B-Tree (Unique) | Búsqueda rápida e invalidación de tokens de autoservicio. |

---

## 5. Multi-Tenancy & Partitioning Architecture

- **Aislamiento**: Arquitectura institucional dedicada con partición lógica basada en esquemas relacionales.
- **Integridad Referencial**: Forzada a nivel motor con claves foráneas estrictas y restricciones ON DELETE RESTRICT en entidades críticas.

---

## 6. Data Integrity & Zero-Downtime Migration Protocols

- **Workflow de Migraciones**: Gestionado exclusivamente vía Prisma Migrate (`app/prisma/migrations/`).
- **Protocolo de Aplicación**:
  1. Desarrollo: `pnpm --dir app exec prisma migrate dev --name <descripcion>`.
  2. Despliegue CI/Prod: `pnpm --dir app exec prisma migrate deploy`.
- **Semilla Idempotente**: `app/prisma/seed.ts` utiliza operaciones upsert para garantizar idempotencia en inicialización y pruebas.

---

## 7. Security, Encryption & Privacy Controls

- **Cero Secretos en Claro**: Las contraseñas se almacenan exclusivamente como hashes Bcrypt (10 rondas de salt).
- **Tokens Efímeros Hash-Only**: Los tokens de restablecimiento se entregan al usuario en texto plano y se persisten en base de datos únicamente como digest SHA-256 de 64 caracteres.
- **Principio de Mínimo Privilegio**: La cuenta de aplicación opera sin permisos de alteración de base de datos fuera de las migraciones controladas.

---

## 8. Disaster Recovery & Backup Topology

- **Respaldos Diarios**: Volcados automáticos pg_dump con compresión gzip en repositorio de seguridad.
- **Point-In-Time Recovery (PITR)**: Habilitado mediante archivado continuo de WAL (Write-Ahead Logging).
