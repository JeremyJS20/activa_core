# Database Architecture & Data Model: ActivaCore

> 🗄️ Master Database Architecture Document · Living Data Blueprint
> 🔄 Last Updated: 2026-10-17 · Status: Active / Production Scheme Certified (Sub-00, Sub-01 & Sub-02)
> 👤 Data Authority: Dirección de Tecnología & Finanzas (UNAPEC)
> 🐘 Engine: PostgreSQL 16 (Neon Serverless PostgreSQL / AWS RDS Multi-AZ) · ORM: Prisma 6.19
> ⚠️ **MANDATORY QUALITY GATE (Hard Gate 12)**: Este documento detalla exhaustivamente el DDL físico, tipos SQL exactos, restricciones, índices B-Tree y protocolos de migración determinista.

---

## 1. Engine Specifications & Connection Architecture

### 1.1 Server & Instance Configuration
- **Motor y Versión**: PostgreSQL 16.x (Neon Serverless Pooler / AWS RDS).
- **Codificación Primaria**: UTF-8 · Collation: en_US.UTF-8.
- **Zona Horaria**: UTC (Todas las fechas y timestamps se almacenan estrictamente en UTC).
- **Extensiones Activas**:
  - `uuid-ossp` / `pgcrypto`: Generación criptográfica nativa de UUIDv4 (`gen_random_uuid()`).

### 1.2 Connection Pooling & Client Strategy
- **Cliente ORM**: Prisma ORM 6.19 (`@prisma/client`) configurado como singleton global en `app/lib/prisma.ts`.
- **Límites de Pool**:
  - `connection_limit`: 10 conexiones simultáneas por instancia de aplicación.
  - `pool_timeout`: 10 segundos.
  - `connect_timeout`: 5 segundos.
- **Cadena de Conexión**: Parametrizada vía variable de entorno `DATABASE_URL` en `.env` (no versionada).

---

## 2. Master Entity-Relationship Diagram (Global Domain ERD)

```mermaid
erDiagram
    roles ||--o{ roles_permisos : asigna
    permisos ||--o{ roles_permisos : contiene
    roles ||--o{ usuarios : clasifica
    usuarios ||--o{ password_reset_tokens : emite
    departamentos ||--o{ empleados : asigna
    departamentos }o--|| empleados : lidera
    empleados ||--o{ usuarios : vincula
    tipos_activos ||--o{ activos_fijos : clasifica
    departamentos ||--o{ activos_fijos : radica
    empleados ||--o{ activos_fijos : custodia
    activos_fijos ||--o{ historial_custodia : registra
    activos_fijos ||--o| historial_bajas : desincorpora
    usuarios ||--o{ historial_custodia : autoriza_traslado
    usuarios ||--o{ historial_bajas : autoriza_baja
    activos_fijos ||--o{ depreciaciones_mensual : "cuotas_provisionales_legacy"
    usuarios ||--o{ bitacora_exportaciones : audita_exportacion
    periodos_depreciacion ||--o{ detalle_depreciacion : contiene
    activos_fijos ||--o{ detalle_depreciacion : deprecia
    periodos_depreciacion ||--o| asientos_contables : genera
    asientos_contables ||--o{ lineas_asiento : compone
    usuarios ||--o{ periodos_depreciacion : ejecuta_y_cierra
    usuarios ||--o{ auditoria : registra

    departamentos {
        uuid id PK
        string codigo UK
        string descripcion
        uuid responsable_id FK
        string estado
        timestamptz created_at
        timestamptz updated_at
    }

    tipos_activos {
        uuid id PK
        string codigo UK
        string descripcion
        string cuenta_contable_compra
        string cuenta_contable_depreciacion
        string cuenta_contable_gasto_depreciacion
        string metodo_depreciacion
        decimal porcentaje_depreciacion_anual
        integer vida_util_meses
        string estado
        timestamptz created_at
        timestamptz updated_at
    }

    empleados {
        uuid id PK
        string codigo UK
        string nombre
        string apellido
        string tipo_persona
        string cedula UK
        uuid departamento_id FK
        string cargo
        string correo
        string telefono
        date fecha_ingreso
        string estado
        timestamptz created_at
        timestamptz updated_at
    }

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
        boolean utilizado
        timestamptz created_at
    }

    activos_fijos {
        uuid id PK
        string codigo UK
        string descripcion
        string marca
        string modelo
        string numero_serie
        string color
        string ubicacion_fisica
        uuid tipo_activo_id FK
        uuid departamento_id FK
        uuid empleado_id FK
        date fecha_adquisicion
        decimal costo_adquisicion
        decimal valor_residual
        decimal depreciacion_acumulada
        decimal valor_en_libros
        string estado
        timestamptz created_at
        timestamptz updated_at
    }

    historial_custodia {
        uuid id PK
        uuid activo_id FK
        uuid empleado_anterior_id FK
        uuid empleado_nuevo_id FK
        uuid departamento_anterior_id FK
        uuid departamento_nuevo_id FK
        string motivo
        string justificacion
        uuid autorizado_por_id FK
        timestamptz fecha_cambio
    }

    historial_bajas {
        uuid id PK
        uuid activo_id UK
        string motivo_baja
        string justificacion
        date fecha_baja
        decimal valor_en_libros_al_baja
        string numero_acta
        uuid autorizado_por_id FK
        timestamptz created_at
    }

    depreciaciones_mensual {
        uuid id PK
        uuid activo_id FK
        char periodo_fiscal UK
        decimal cuota_mes
        decimal depreciacion_acumulada_post
        decimal valor_en_libros_post
        string cuenta_compra
        string cuenta_depreciacion
        timestamptz created_at
    }

    bitacora_exportaciones {
        uuid id PK
        uuid usuario_id FK
        string correo_usuario
        string ip_address
        string user_agent
        string formato
        string reporte
        json filtros_aplicados
        integer filas_exportadas
        timestamptz created_at
    }

    periodos_depreciacion {
        uuid id PK
        integer anio
        integer mes
        string estado
        date fecha_corte
        integer total_activos
        decimal total_cuota
        integer activos_omitidos
        integer activos_excluidos
        timestamptz fecha_ejecucion
        uuid ejecutado_por_id FK
        timestamptz fecha_cierre
        uuid cerrado_por_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    detalle_depreciacion {
        uuid id PK
        uuid periodo_id FK
        uuid activo_id FK
        decimal cuota_mensual
        decimal depreciacion_acumulada_anterior
        decimal depreciacion_acumulada_nueva
        decimal valor_en_libros_anterior
        decimal valor_en_libros_nuevo
        string tipo_cuota
        boolean es_cuota_final
        timestamptz created_at
    }

    asientos_contables {
        uuid id PK
        string numero_asiento UK
        uuid periodo_id UK
        string concepto
        date fecha_contable
        string estado
        decimal total_debito
        decimal total_credito
        timestamptz created_at
        timestamptz updated_at
    }

    lineas_asiento {
        uuid id PK
        uuid asiento_id FK
        string cuenta_contable
        string tipo_movimiento
        decimal monto
        string descripcion
        timestamptz created_at
    }

    auditoria {
        uuid id PK
        uuid usuario_id FK
        string accion
        string recurso
        uuid recurso_id
        json detalle
        string ip_address
        string user_agent
        timestamptz created_at
    }
```

---

## 3. Physical Schema DDL & Data Dictionary

### 3.1 DDL Statements (PostgreSQL 16 Dialect)
```sql
-- ========================================================
-- MODULO 00: SEGURIDAD, RBAC Y CONTROL DE ACCESO
-- ========================================================

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
    utilizado BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tokens_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT uq_tokens_token_hash UNIQUE (token_hash)
);

-- ========================================================
-- MODULO 01: CATALOGOS BASE Y MAESTROS ORGANIZACIONALES
-- ========================================================

-- 6. Tabla: departamentos
CREATE TABLE departamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(10) NOT NULL,
    descripcion VARCHAR(120) NOT NULL,
    responsable_id UUID,
    estado VARCHAR(10) NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_departamentos_codigo UNIQUE (codigo),
    CONSTRAINT chk_departamentos_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);

-- 7. Tabla: tipos_activos
CREATE TABLE tipos_activos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(10) NOT NULL,
    descripcion VARCHAR(150) NOT NULL,
    cuenta_contable_compra VARCHAR(20) NOT NULL,
    cuenta_contable_depreciacion VARCHAR(20) NOT NULL,
    metodo_depreciacion VARCHAR(20) NOT NULL DEFAULT 'LINEA_RECTA',
    porcentaje_depreciacion_anual DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    vida_util_meses INTEGER NOT NULL DEFAULT 12,
    estado VARCHAR(10) NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tipos_activos_codigo UNIQUE (codigo),
    CONSTRAINT chk_tipos_activos_estado CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    CONSTRAINT chk_tipos_activos_metodo CHECK (metodo_depreciacion IN ('DGII_CAT1', 'DGII_CAT2', 'DGII_CAT3', 'LINEA_RECTA')),
    CONSTRAINT chk_tipos_activos_cuentas CHECK (cuenta_contable_compra <> cuenta_contable_depreciacion)
);

-- 8. Tabla: empleados
CREATE TABLE empleados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(10) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    tipo_persona VARCHAR(10) NOT NULL DEFAULT 'FISICA',
    cedula VARCHAR(15) NOT NULL,
    departamento_id UUID NOT NULL,
    cargo VARCHAR(100) NOT NULL,
    correo VARCHAR(150),
    telefono VARCHAR(20),
    fecha_ingreso DATE NOT NULL,
    estado VARCHAR(10) NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_empleados_codigo UNIQUE (codigo),
    CONSTRAINT uq_empleados_cedula UNIQUE (cedula),
    CONSTRAINT chk_empleados_tipo_persona CHECK (tipo_persona IN ('FISICA', 'JURIDICA')),
    CONSTRAINT chk_empleados_estado CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    CONSTRAINT fk_empleados_departamento FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE RESTRICT
);

-- Restriccion diferida: Referencia de jefe de departamento a empleado
ALTER TABLE departamentos
    ADD CONSTRAINT fk_departamentos_responsable
    FOREIGN KEY (responsable_id) REFERENCES empleados(id) ON DELETE SET NULL;

-- ========================================================
-- MODULO 02: GESTION DE ACTIVOS FIJOS, INVENTARIO Y CUSTODIA
-- ========================================================

-- 9. Tabla: activos_fijos
CREATE TABLE activos_fijos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(20) NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    marca VARCHAR(100),
    modelo VARCHAR(100),
    numero_serie VARCHAR(100),
    color VARCHAR(50),
    ubicacion_fisica VARCHAR(200),
    tipo_activo_id UUID NOT NULL,
    departamento_id UUID NOT NULL,
    empleado_id UUID NOT NULL,
    fecha_adquisicion DATE NOT NULL,
    costo_adquisicion DECIMAL(14, 2) NOT NULL,
    valor_residual DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    depreciacion_acumulada DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    valor_en_libros DECIMAL(14, 2) NOT NULL,
    estado VARCHAR(25) NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_activos_fijos_codigo UNIQUE (codigo),
    CONSTRAINT fk_activos_tipo_activo FOREIGN KEY (tipo_activo_id) REFERENCES tipos_activos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_activos_departamento FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_activos_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE RESTRICT
);

-- 10. Tabla: historial_custodia (Append-Only)
CREATE TABLE historial_custodia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activo_id UUID NOT NULL,
    empleado_anterior_id UUID,
    empleado_nuevo_id UUID NOT NULL,
    departamento_anterior_id UUID,
    departamento_nuevo_id UUID NOT NULL,
    motivo VARCHAR(30) NOT NULL,
    justificacion TEXT NOT NULL,
    autorizado_por_id UUID NOT NULL,
    fecha_cambio TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_hc_activo FOREIGN KEY (activo_id) REFERENCES activos_fijos(id) ON DELETE CASCADE,
    CONSTRAINT fk_hc_empleado_nuevo FOREIGN KEY (empleado_nuevo_id) REFERENCES empleados(id) ON DELETE RESTRICT,
    CONSTRAINT fk_hc_departamento_nuevo FOREIGN KEY (departamento_nuevo_id) REFERENCES departamentos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_hc_autorizado_por FOREIGN KEY (autorizado_por_id) REFERENCES usuarios(id) ON DELETE RESTRICT
);

-- 11. Tabla: historial_bajas
CREATE TABLE historial_bajas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activo_id UUID NOT NULL,
    motivo_baja VARCHAR(40) NOT NULL,
    justificacion TEXT NOT NULL,
    fecha_baja DATE NOT NULL,
    valor_en_libros_al_baja DECIMAL(14, 2) NOT NULL,
    numero_acta VARCHAR(50) NOT NULL,
    autorizado_por_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_historial_bajas_activo UNIQUE (activo_id),
    CONSTRAINT fk_hb_activo FOREIGN KEY (activo_id) REFERENCES activos_fijos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_hb_autorizado_por FOREIGN KEY (autorizado_por_id) REFERENCES usuarios(id) ON DELETE RESTRICT
);

-- 12. Tabla: depreciaciones_mensual (CONTRATO PROVISIONAL Sub-04 — sin uso desde la integración de Sub-03)
CREATE TABLE depreciaciones_mensual (
    id VARCHAR(36) PRIMARY KEY,
    activo_id VARCHAR(36) NOT NULL,
    periodo_fiscal CHAR(7) NOT NULL,
    cuota_mes DECIMAL(14, 2) NOT NULL,
    depreciacion_acumulada_post DECIMAL(14, 2) NOT NULL,
    valor_en_libros_post DECIMAL(14, 2) NOT NULL,
    cuenta_compra VARCHAR(20) NOT NULL,
    cuenta_depreciacion VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dm_activo FOREIGN KEY (activo_id) REFERENCES activos_fijos(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX depreciaciones_mensual_periodo_fiscal_activo_id_idx ON depreciaciones_mensual(periodo_fiscal, activo_id);
CREATE UNIQUE INDEX depreciaciones_mensual_activo_id_periodo_fiscal_key ON depreciaciones_mensual(activo_id, periodo_fiscal);

-- 13. Tabla: bitacora_exportaciones (Sub-04 exclusiva — auditoría de exportaciones)
CREATE TABLE bitacora_exportaciones (
    id VARCHAR(36) PRIMARY KEY,
    usuario_id VARCHAR(36) NOT NULL,
    correo_usuario VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent VARCHAR(400),
    formato VARCHAR(10) NOT NULL,
    reporte VARCHAR(30) NOT NULL,
    filtros_aplicados JSONB NOT NULL,
    filas_exportadas INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_be_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX bitacora_exportaciones_usuario_id_created_at_idx ON bitacora_exportaciones(usuario_id, created_at DESC);

-- ========================================================
-- MODULO 03: MOTOR DE DEPRECIACION Y CONTABILIZACION DGII
-- ========================================================

-- 14. Columna de cuenta de gasto por depreciacion en el catalogo fiscal
ALTER TABLE tipos_activos
    ADD COLUMN cuenta_contable_gasto_depreciacion VARCHAR(20);

-- 15. Tabla: periodos_depreciacion
CREATE TABLE periodos_depreciacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anio INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    estado VARCHAR(12) NOT NULL DEFAULT 'ABIERTO',
    fecha_corte DATE NOT NULL,
    total_activos INTEGER NOT NULL DEFAULT 0,
    total_cuota DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    activos_omitidos INTEGER NOT NULL DEFAULT 0,
    activos_excluidos INTEGER NOT NULL DEFAULT 0,
    fecha_ejecucion TIMESTAMPTZ,
    ejecutado_por_id UUID,
    fecha_cierre TIMESTAMPTZ,
    cerrado_por_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_periodos_depreciacion_anio_mes UNIQUE (anio, mes),
    CONSTRAINT chk_periodos_depreciacion_estado CHECK (estado IN ('ABIERTO', 'CALCULADO', 'CERRADO')),
    CONSTRAINT chk_periodos_depreciacion_mes CHECK (mes BETWEEN 1 AND 12),
    CONSTRAINT chk_periodos_depreciacion_anio CHECK (anio BETWEEN 2000 AND 2100),
    CONSTRAINT fk_pd_ejecutado_por FOREIGN KEY (ejecutado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_pd_cerrado_por FOREIGN KEY (cerrado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 14. Tabla: detalle_depreciacion
CREATE TABLE detalle_depreciacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo_id UUID NOT NULL,
    activo_id UUID NOT NULL,
    cuota_mensual DECIMAL(14, 2) NOT NULL,
    depreciacion_acumulada_anterior DECIMAL(14, 2) NOT NULL,
    depreciacion_acumulada_nueva DECIMAL(14, 2) NOT NULL,
    valor_en_libros_anterior DECIMAL(14, 2) NOT NULL,
    valor_en_libros_nuevo DECIMAL(14, 2) NOT NULL,
    tipo_cuota VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    es_cuota_final BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_detalle_depreciacion_periodo_activo UNIQUE (periodo_id, activo_id),
    CONSTRAINT chk_detalle_depreciacion_tipo_cuota CHECK (tipo_cuota IN ('NORMAL', 'ULTIMA', 'NO_DEPRECIABLE')),
    CONSTRAINT fk_dd_periodo FOREIGN KEY (periodo_id) REFERENCES periodos_depreciacion(id) ON DELETE CASCADE,
    CONSTRAINT fk_dd_activo FOREIGN KEY (activo_id) REFERENCES activos_fijos(id) ON DELETE RESTRICT
);

-- 15. Tabla: asientos_contables
CREATE TABLE asientos_contables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_asiento VARCHAR(20) NOT NULL,
    periodo_id UUID NOT NULL,
    concepto VARCHAR(150) NOT NULL,
    fecha_contable DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE_ENVIO',
    total_debito DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    total_credito DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_asientos_contables_numero UNIQUE (numero_asiento),
    CONSTRAINT uq_asientos_contables_periodo UNIQUE (periodo_id),
    CONSTRAINT chk_asientos_contables_estado CHECK (estado IN ('PENDIENTE_ENVIO', 'ENVIADO', 'ERROR')),
    CONSTRAINT chk_asientos_contables_cuadre CHECK (total_debito = total_credito),
    CONSTRAINT fk_ac_periodo FOREIGN KEY (periodo_id) REFERENCES periodos_depreciacion(id) ON DELETE RESTRICT
);

-- 16. Tabla: lineas_asiento
CREATE TABLE lineas_asiento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asiento_id UUID NOT NULL,
    cuenta_contable VARCHAR(20) NOT NULL,
    tipo_movimiento VARCHAR(10) NOT NULL,
    monto DECIMAL(14, 2) NOT NULL,
    descripcion VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_lineas_asiento_movimiento CHECK (tipo_movimiento IN ('DEBITO', 'CREDITO')),
    CONSTRAINT chk_lineas_asiento_monto CHECK (monto > 0),
    CONSTRAINT fk_la_asiento FOREIGN KEY (asiento_id) REFERENCES asientos_contables(id) ON DELETE CASCADE
);

-- 17. Tabla: auditoria (bitacora append-only del modulo)
CREATE TABLE auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID,
    accion VARCHAR(40) NOT NULL,
    recurso VARCHAR(60) NOT NULL,
    recurso_id UUID,
    detalle JSONB,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
```

### 3.2 Cobertura Read-Only del Sub-módulo 04 (Reportes)

El Sub-módulo 04 **no posee dominio de escritura** sobre el esquema operativo. Su cobertura se limita a SELECT sobre el dominio de Sub-01/Sub-02 y a INSERT en su propia bitácora:

| Tabla | Origen | Acceso Sub-04 | Gobernanza |
|---|---|---|---|
| `activos_fijos`, `historial_custodia`, `historial_bajas` | Sub-02 | SELECT | Solo lectura: nunca UPDATE/DELETE ni recálculo financiero. |
| `departamentos`, `tipos_activos`, `empleados` | Sub-01 | SELECT | Solo lectura para filtros y cuentas contables. |
| `periodos_depreciacion`, `detalle_depreciacion` | Sub-03 | SELECT | Fuente oficial del reporte de depreciación y del Kardex (reemplaza al contrato provisional). |
| `depreciaciones_mensual` | **Contrato provisional Sub-04** | Sin uso | **Legacy** — ninguna consulta la lee desde la integración de Sub-03; su DROP está pendiente de autorización. |
| `bitacora_exportaciones` | Sub-04 (exclusiva) | INSERT | Auditoría de exportaciones financieras (NFR-REP-005). |

> ✅ **Contrato provisional resuelto:** Sub-03 entregó su esquema oficial y el Sub-04 ya fue re-apuntado. `report.service.ts`, el kardex y la consola `/reportes/depreciacion` leen `detalle_depreciacion` + `periodos_depreciacion`; `seedCuotasDepreciacion` fue eliminado para no sobrescribir la depreciación acumulada real de los activos. La tabla `depreciaciones_mensual` permanece en la base compartida (y en el schema Prisma) únicamente hasta que se autorice su migración de `DROP`.

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
| idx_departamentos_codigo | departamentos | codigo | B-Tree (Unique) | Resolución unívoca de centros de costos institucionales. |
| idx_departamentos_estado | departamentos | estado | B-Tree | Filtrado de unidades activas para asignaciones de activos. |
| idx_tipos_activos_codigo | tipos_activos | codigo | B-Tree (Unique) | Resolución unívoca de clases de activos fijos. |
| idx_tipos_activos_estado | tipos_activos | estado | B-Tree | Filtros de tipos de activos habilitados para nuevas altas. |
| idx_empleados_codigo | empleados | codigo | B-Tree (Unique) | Búsqueda rápida por matrícula institucional de custodio. |
| idx_empleados_cedula | empleados | cedula | B-Tree (Unique) | Verificación O(1) de unicidad en padrón JCE y RNC DGII. |
| idx_empleados_departamento_id | empleados | departamento_id | B-Tree | Joins de empleados adscritos por departamento. |
| idx_empleados_estado | empleados | estado | B-Tree | Filtrado de colaboradores aptos para asignación de bienes. |
| idx_activos_fijos_codigo | activos_fijos | codigo | B-Tree (Unique) | Búsqueda O(1) por código correlativo anual ACT-YYYY-NNNN. |
| idx_activos_fijos_departamento_id | activos_fijos | departamento_id | B-Tree | Filtrado de inventario por centro de costos departamental. |
| idx_activos_fijos_tipo_activo_id | activos_fijos | tipo_activo_id | B-Tree | Filtrado de bienes por categoría fiscal DGII. |
| idx_activos_fijos_empleado_id | activos_fijos | empleado_id | B-Tree | Consulta de activos bajo custodia de un empleado. |
| idx_activos_fijos_estado | activos_fijos | estado | B-Tree | Filtrado rápido por estado operativo o dados de baja. |
| idx_activos_fijos_numero_serie | activos_fijos | numero_serie | B-Tree | Búsqueda por número de serie de fabricante. |
| idx_historial_custodia_activo_fecha | historial_custodia | (activo_id, fecha_cambio DESC) | B-Tree (Composite) | Recuperación cronológica de movimientos de custodia. |
| idx_historial_bajas_fecha_baja | historial_bajas | fecha_baja | B-Tree | Auditoría fiscal de bajas por período contable. |
| idx_activos_fijos_fecha_adquisicion | activos_fijos | fecha_adquisicion | B-Tree | Filtro por rango de fechas del reporte de inventario (Sub-04, índice aditivo). |
| idx_activos_fijos_costo_adquisicion | activos_fijos | costo_adquisicion | B-Tree | Filtro por rango de costo del reporte de inventario (Sub-04, índice aditivo). |
| uq_depreciaciones_mensual_activo_periodo | depreciaciones_mensual | (activo_id, periodo_fiscal) | B-Tree (Unique) | Idempotencia del contrato provisional por activo/período (legacy, sin uso desde Sub-03). |
| idx_depreciaciones_mensual_periodo_activo | depreciaciones_mensual | (periodo_fiscal, activo_id) | B-Tree (Composite) | Consulta del contrato provisional por período fiscal (legacy, sin uso desde Sub-03). |
| idx_bitacora_exportaciones_usuario_fecha | bitacora_exportaciones | (usuario_id, created_at DESC) | B-Tree (Composite) | Trazabilidad de exportaciones financieras por usuario (NFR-REP-005). |
| idx_periodos_depreciacion_anio_mes | periodos_depreciacion | (anio, mes) | B-Tree (Unique) | Garantiza un único período por mes y acelera el orden descendente del listado. |
| idx_periodos_depreciacion_estado | periodos_depreciacion | estado | B-Tree | Filtro de períodos abiertos, calculados o cerrados en la consola. |
| idx_detalle_depreciacion_periodo | detalle_depreciacion | periodo_id | B-Tree | Carga del desglose por activo del período en un solo recorrido. |
| idx_detalle_depreciacion_activo | detalle_depreciacion | activo_id | B-Tree | Trazabilidad histórica de cuotas por activo (Kardex y reporte de Sub-04). |
| idx_asientos_contables_estado | asientos_contables | estado | B-Tree | Bandeja de asientos `PENDIENTE_ENVIO` para el despacho contable del Sub-05. |
| idx_lineas_asiento_asiento_id | lineas_asiento | asiento_id | B-Tree | Recuperación de líneas débito/crédito de un asiento. |
| idx_auditoria_accion | auditoria | accion | B-Tree | Consulta de eventos por tipo (`DEPRECIATION_RUN`, `PERIOD_CLOSE`). |
| idx_auditoria_recurso_id | auditoria | recurso_id | B-Tree | Traza completa de un período o activo específico. |
| idx_auditoria_usuario_id | auditoria | usuario_id | B-Tree | Bitácora de acciones por colaborador. |

---

## 5. Multi-Tenancy & Partitioning Architecture

- **Aislamiento**: Arquitectura institucional dedicada con partición lógica basada en esquemas relacionales.
- **Integridad Referencial**: Forzada a nivel motor con claves foráneas estrictas y restricciones `ON DELETE RESTRICT` en entidades críticas (ej. departamentos con custodios adscritos).

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