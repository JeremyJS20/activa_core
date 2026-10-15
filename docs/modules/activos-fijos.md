# ActivaCore — Sistema de Gestión de Activos Fijos & Contabilización DGII

> 📖 Master Module Documentation · Living Domain Document
> 🔄 Last Updated: 2026-10-15 · Status: Active / Certified Sub-00 & Sub-01
> 👤 Technical & Functional Lead: Dirección de Tecnología & Finanzas (UNAPEC)
> 📂 Scope: Gestión integral del ciclo de vida de activos fijos institucionales, asignación y transferencias de custodios, motor de cálculo de depreciación por línea recta bajo normativa DGII (Norma General 07-07 / Ley 11-92 Art. 287), integración contable auxiliar y gobernanza de acceso basada en roles relacionales (RBAC).

---

## 1. Executive Summary & Domain Scope

### 1.1 Business Mission & Actors
- **Business Domain**: Gestión Patrimonial, Activos Fijos y Contabilidad Fiscal Universitaria.
- **Target Actors & Boundaries**:
  - **Administrador General (ADMIN)**: Acceso total y configuración de gobernanza institucional, seguridad, gestión de usuarios, catálogo de roles y permisos, auditoría y parámetros contables.
  - **Operador de Activos Fijos (OPERADOR)**: Registro de altas, transferencias entre custodios, catalogación física, cálculo mensual de depreciación y generación de asientos contables para despacho.
  - **Auditor de Cumplimiento (AUDITOR)**: Consulta de solo lectura de fichas patrimoniales, traza de auditoría, bitácora de integraciones contables y reportes ejecutivos fiscales.
  - **Servicio Web Contable Externo (WS Contabilidad UNAPEC)**: Ingestión síncrona o asíncrona de comprobantes y asientos de depreciación mensual vía API REST institucional.
- **Core Value Proposition**: Automatización y exactitud en el control físico-financiero de los activos universitarios, eliminación de discrepancias contables, cálculo determinista de depreciación fiscal DGII al centavo, y trazabilidad inmutable de custodios y transacciones.

### 1.2 Primary Routes & Frontend Navigation
| Route | View / Screen | Target Audience / Role | Status |
|-------|---------------|------------------------|--------|
| /login | Pantalla Institucional de Inicio de Sesión | Todos los colaboradores autenticables | ✅ Certified |
| /recuperar-contrasena | Solicitud de Restablecimiento de Credenciales | Colaboradores con cuenta institucional activa | ✅ Certified |
| /restablecer-contrasena | Ingreso de Nueva Contraseña Tokenizada | Titular del token criptográfico de un solo uso | ✅ Certified |
| /perfil | Gestión de Perfil & Actualización de Contraseña | Usuario autenticado en sesión activa | ✅ Certified |
| /admin/usuarios | Directorio de Usuarios, RBAC & Desbloqueo | Administrador General (ADMIN / USER_ADMIN) | ✅ Certified |
| / | Consola Principal y Tablero Institucional | Usuarios autenticados según matriz RBAC | ✅ Certified |
| /catalogos/departamentos | Estructura Orgánica y Centros de Costos | Operadores y Administradores (CAT_READ, CAT_WRITE) | ✅ Certified |
| /catalogos/tipos-activos | Clasificación Fiscal DGII y Cuentas Contables | Operadores y Administradores (CAT_READ, CAT_WRITE) | ✅ Certified |
| /catalogos/empleados | Directorio de Custodios y Colaboradores | Operadores y Administradores (CAT_READ, CAT_WRITE) | ✅ Certified |
| /api/catalogos/export | Exportación Tabular (.xlsx y .csv) | Operadores, Auditores y Administradores (CAT_READ) | ✅ Certified |
| /activos | Registro Patrimonial y Fichas de Activos | Operadores y Administradores (ACT_READ, ACT_CREATE) | ⏳ Pending (Sub-02) |
| /depreciacion | Corrida Mensual y Asientos de Depreciación DGII | Operadores y Administradores (DEP_CALCULATE) | ⏳ Pending (Sub-03) |
| /reportes | Consultas Fiscales y Conciliación DGII | Auditores, Operadores y Administradores (REP_READ) | ⏳ Pending (Sub-04) |

---

## 2. Capabilities & Sub-Features Matrix

| # | Sub-module / Capability | Functional Description | Status | Spec Link | Test Coverage |
|---|-------------------------|------------------------|--------|-----------|---------------|
| **00** | **Autenticación, Usuarios y Control de Acceso Relacional RBAC** | Inicio de sesión NextAuth v5, hashing bcrypt (10 rondas), protección contra fuerza bruta (15 min / 5 intentos), tokens SHA-256 de autoservicio, middleware edge y directorio de roles dinámicos. | ✅ Certified | [specs/activos-fijos/00-autenticacion-rbac/](../../specs/activos-fijos/00-autenticacion-rbac/requirements.md) | Unit: 92.7% (45 pruebas Vitest) · E2E: ✅ (4/4 Playwright) |
| **01** | **Catálogos Base del Sistema** | Mantenimiento de Departamentos, Cuentas Contables Auxiliares, Tipos de Activos con Vida Útil DGII (Cat 1: 5%, Cat 2: 25%, Cat 3: 15%), validación cripto-aritmética Módulo 10 de Cédulas JCE y Módulo 11 de RNC, interfaz unificada con layout de pestañas, búsqueda debounced y exportación a Excel (.xlsx) y CSV con UTF-8 BOM. | ✅ Certified | [specs/activos-fijos/01-catalogos-base/](../../specs/activos-fijos/01-catalogos-base/requirements.md) | Unit & Integration: 94.16% (123 pruebas Vitest) · E2E: ✅ (5/5 Playwright) |
| **02** | **Gestión de Activos Fijos y Custodia** | Altas patrimoniales, códigos de barra / serialización única, ficha técnica, asignación a empleados, transferencias de ubicación física y bajas autorizadas. | ⏳ Pending | [specs/activos-fijos/02-gestion-activos-custodia/](../../specs/activos-fijos/02-gestion-activos-custodia/requirements.md) | Pendiente de inicio |
| **03** | **Motor de Depreciación y Contabilización DGII** | Cálculo mensual determinista por línea recta según Ley 11-92 Art. 287 (Categorías 1, 2 y 3), generación de asientos contables débitos/créditos y cierre mensual inmutable. | ⏳ Pending | Planificado Sub-03 | Pendiente de inicio |
| **04** | **Reportes, Auditoría e Integración Contable Externa** | Consultas multicriterio, exportación a Excel / PDF, trazabilidad inmutable de eventos y despacho al Web Service Contable de la Universidad. | ⏳ Pending | Planificado Sub-04 | Pendiente de inicio |

---

## 3. Architecture & Domain Lifecycle

### 3.1 Module State Machine (Ciclos de Vida)

#### Seguridad y Sesión
```mermaid
stateDiagram-v2
    [*] --> Inactivo : Registro Administrativo del Colaborador
    Inactivo --> Activo : Activacion y Asignacion de Rol
    Activo --> Autenticado : Credenciales Validas bcrypt match
    Activo --> BloqueadoTemporal : 5 Intentos Fallidos Consecutivos Rate Limit
    BloqueadoTemporal --> Activo : Expiracion de Ventana 15 min o Desbloqueo por Admin
    Autenticado --> SesionCerrada : Cierre Manual SignOut o Expiracion JWT
    SesionCerrada --> [*]
    Activo --> Inactivo : Desactivacion por Auditoria o RRHH
```

#### Catálogos Base (Departamentos, Tipos de Activos y Custodios)
```mermaid
stateDiagram-v2
    [*] --> ACTIVO : Alta con Validacion Zod & Modulo 10
    ACTIVO --> INACTIVO : Inactivacion Logica (Preserva Trazabilidad)
    INACTIVO --> ACTIVO : Reactivacion Operativa
    ACTIVO --> [*] : Borrado Fisico (Solo si no tiene relaciones)
    INACTIVO --> [*] : Borrado Fisico (Solo si no tiene relaciones)
```

### 3.2 High-Level Component Flow
```mermaid
flowchart TD
    Browser[Navegador Web Next.js 16 SSR / Client] --> Shell[Layout Unificado /catalogos/layout.tsx]
    Shell --> Tabs[Tabs: Departamentos / Tipos / Empleados]
    Tabs --> DataTable[CatalogDataTable: Debounce 200ms, Paginacion, Export]
    DataTable --> API_Catalogos[Route Handlers /api/departamentos /api/tipos-activos /api/empleados /api/catalogos/export]
    API_Catalogos --> RBAC_Gate[Verificacion Permisos CAT_READ / CAT_WRITE]
    RBAC_Gate --> Validators[Motores de Validacion: validarCedulaJCE / validarRncDGII / validarCuentaContable]
    Validators --> Prisma[Prisma ORM 6.19 Client]
    Prisma --> PostgreSQL[(Neon PostgreSQL 16: departamentos, tipos_activos, empleados, rbac)]
```

---

## 4. Consolidated Data Model (Module ERD)

```mermaid
erDiagram
    roles ||--o{ roles_permisos : asigna
    permisos ||--o{ roles_permisos : contiene
    roles ||--o{ usuarios : clasifica
    usuarios ||--o{ password_reset_tokens : emite
    departamentos ||--o{ empleados : asigna
    departamentos }o--|| empleados : lidera
    empleados ||--o{ usuarios : vincula

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
```

### Key Tables & Data Dictionary
- **`departamentos`**: Unidades organizativas y centros de costos universitarios para custodia patrimonial.
  - `id`: UUID (PK).
  - `codigo`: VARCHAR(10) UNIQUE, clave correlativa institucional (`DEP-XXX`).
  - `descripcion`: VARCHAR(120), denominación oficial del departamento.
  - `responsable_id`: UUID (FK nullable), referencia al colaborador que actúa como titular de la unidad (`onDelete: SetNull`).
  - `estado`: VARCHAR(10), `ACTIVO` o `INACTIVO`.
- **`tipos_activos`**: Catálogo de clasificación física y contable con vida útil estatuida por la DGII.
  - `id`: UUID (PK).
  - `codigo`: VARCHAR(10) UNIQUE, clave correlativa (`TPA-XXX`).
  - `descripcion`: VARCHAR(150), familia o clase de activo.
  - `cuenta_contable_compra`: VARCHAR(20), cuenta de mayor auxiliar formato `X-XX-XX-XXXX`.
  - `cuenta_contable_depreciacion`: VARCHAR(20), cuenta de depreciación acumulada formato `X-XX-XX-XXXX`.
  - `metodo_depreciacion`: VARCHAR(20), método fiscal (`DGII_CAT1`, `DGII_CAT2`, `DGII_CAT3`, `LINEA_RECTA`).
  - `porcentaje_depreciacion_anual`: DECIMAL(5,2), tasa anual oficial (5.00%, 25.00%, 15.00%).
  - `vida_util_meses`: INTEGER, duración contable total en meses (240, 48, 80).
  - `estado`: VARCHAR(10), `ACTIVO` o `INACTIVO`.
- **`empleados`**: Personal universitario habilitado para custodia formal de bienes patrimoniales.
  - `id`: UUID (PK).
  - `codigo`: VARCHAR(10) UNIQUE, clave institucional (`EMP-XXXX`).
  - `nombre`: VARCHAR(100), nombres del colaborador.
  - `apellido`: VARCHAR(100), apellidos del colaborador.
  - `tipo_persona`: VARCHAR(10), `FISICA` o `JURIDICA`.
  - `cedula`: VARCHAR(15) UNIQUE, cédula dominicana validada vía Módulo 10 JCE (o RNC vía Módulo 11).
  - `departamento_id`: UUID (FK), centro de costos de adscripción (`onDelete: Restrict`).
  - `cargo`: VARCHAR(100), posición institucional.
  - `correo`: VARCHAR(150), correo electrónico institucional.
  - `telefono`: VARCHAR(20), extensión o teléfono de contacto.
  - `fecha_ingreso`: DATE, fecha de contratación (no admite fechas futuras).
  - `estado`: VARCHAR(10), `ACTIVO` o `INACTIVO`.

---

## 5. Master API Catalog

| Method | Endpoint | Description | Authorized Roles | Request Payload | Response (200/201) |
|--------|----------|-------------|------------------|-----------------|--------------------|
| POST | /api/auth/[...nextauth] | Autenticación institucional por credenciales | Público (Todos) | { correo, password } | Sesión JWT / HttpOnly Cookie |
| POST | /api/auth/forgot-password | Emisión de token de autoservicio de clave | Público (Todos) | { correo } | { success: true, message: "Solicitud procesada" } |
| POST | /api/auth/reset-password | Consumo de token y reseteo de contraseña | Público (Token) | { token, password } | { success: true, message: "Contraseña actualizada" } |
| PUT | /api/auth/change-password | Cambio de contraseña para usuario autenticado | Sesión Activa | { currentPassword, newPassword } | { success: true, message: "Contraseña modificada" } |
| GET | /api/usuarios | Consulta paginada del directorio de usuarios | USER_ADMIN / ADMIN | Query: ?page=1&limit=10 | { usuarios: [...], total, page, totalPages } |
| POST | /api/usuarios | Alta de nuevo colaborador institucional | USER_ADMIN / ADMIN | { nombre, correo, password, rolId } | { success: true, usuario: { id, nombre, correo } } |
| POST | /api/usuarios/[id]/unlock | Desbloqueo administrativo de cuenta throttled | USER_ADMIN / ADMIN | Ninguno (URL param) | { success: true, message: "Usuario desbloqueado" } |
| GET | /api/roles | Consulta del catálogo de roles y permisos | USER_ADMIN / ADMIN | Ninguno | [ { id, codigo, nombre, permisos: [...] } ] |
| GET | /api/departamentos | Listado paginado de departamentos con conteo | CAT_READ / ADMIN / OPERADOR | Query: ?page=1&limit=10&search=&estado= | { data: [...], pagination: { total, page, limit, totalPages } } |
| POST | /api/departamentos | Alta de nuevo departamento institucional | CAT_WRITE / ADMIN / OPERADOR | { descripcion, codigo?, responsableId?, estado? } | { data: { id, codigo, descripcion, ... } } (201) |
| PUT | /api/departamentos/[id] | Modificación de departamento o estado | CAT_WRITE / ADMIN / OPERADOR | { descripcion, codigo?, responsableId?, estado? } | { data: { id, codigo, descripcion, ... } } (200) |
| DELETE | /api/departamentos/[id] | Eliminación física restringida si no hay empleados | CAT_WRITE / ADMIN / OPERADOR | Ninguno (URL param) | { success: true, message: "Departamento eliminado" } |
| GET | /api/tipos-activos | Listado paginado de tipos de activos fiscales | CAT_READ / ADMIN / OPERADOR | Query: ?page=1&limit=10&search=&regimen=&estado= | { data: [...], pagination: { total, page, limit, totalPages } } |
| POST | /api/tipos-activos | Alta de tipo de activo con categoría DGII | CAT_WRITE / ADMIN / OPERADOR | { descripcion, cuentaContableCompra, cuentaContableDepreciacion, metodoDepreciacion, ... } | { data: { id, codigo, ... } } (201) |
| PUT | /api/tipos-activos/[id] | Modificación de tipo de activo y cuentas | CAT_WRITE / ADMIN / OPERADOR | { descripcion, cuentaContableCompra, cuentaContableDepreciacion, ... } | { data: { id, codigo, ... } } (200) |
| DELETE | /api/tipos-activos/[id] | Eliminación física restringida si no hay activos | CAT_WRITE / ADMIN / OPERADOR | Ninguno (URL param) | { success: true, message: "Tipo de activo eliminado" } |
| GET | /api/empleados | Directorio de empleados custodios paginado | CAT_READ / ADMIN / OPERADOR | Query: ?page=1&limit=10&search=&departamentoId=&estado= | { data: [...], pagination: { total, page, limit, totalPages } } |
| POST | /api/empleados | Registro de custodio con validación Módulo 10 | CAT_WRITE / ADMIN / OPERADOR | { nombre, apellido, cedula, tipoPersona, departamentoId, cargo, fechaIngreso, ... } | { data: { id, codigo, ... } } (201) |
| PUT | /api/empleados/[id] | Modificación de custodio o estado operativo | CAT_WRITE / ADMIN / OPERADOR | { nombre, apellido, departamentoId, cargo, estado, ... } | { data: { id, codigo, ... } } (200) |
| DELETE | /api/empleados/[id] | Eliminación o inactivación de custodio | CAT_WRITE / ADMIN / OPERADOR | Ninguno (URL param) | { success: true, message: "Empleado eliminado" } |
| GET | /api/catalogos/export | Exportación tabular Excel (.xlsx) y CSV | CAT_READ / ADMIN / OPERADOR / AUDITOR | Query: ?catalogo=departamentos&format=xlsx | Archivo binario con cabecera Content-Disposition |

---

## 6. Universal Business Rules, Formulas & Compliance

### 6.1 Régimen Fiscal de Depreciación DGII (Ley 11-92 Art. 287)
| Categoría Fiscal | Bienes Incluidos | Tasa Anual | Vida Útil | Método de Cálculo |
|------------------|------------------|------------|-----------|-------------------|
| **Categoría 1 DGII** | Edificaciones, componentes estructurales e infraestructura fija | **5.00%** | **240 meses** (20 años) | Línea Recta / Costo Histórico |
| **Categoría 2 DGII** | Equipos de transporte, computación, servidores y mobiliario de oficina | **25.00%** | **48 meses** (4 años) | Línea Recta / Costo Histórico |
| **Categoría 3 DGII** | Maquinaria pesada, transformadores, generadores y otros bienes | **15.00%** | **80 meses** (6.67 años) | Línea Recta / Costo Histórico |

### 6.2 Motor de Validación Cripto-Aritmética de Identidad Dominicana
- **Cédula de Identidad y Electoral JCE (Módulo 10)**:
  - Longitud exacta: 11 dígitos numéricos sin ceros continuos.
  - Multiplicadores cíclicos alternados: `[1, 2, 1, 2, 1, 2, 1, 2, 1, 2]`.
  - Los productos mayores a 9 se reducen sumando sus dígitos o restando 9 (`prod > 9 ? prod - 9 : prod`).
  - El residuo de la suma módulo 10 define el dígito verificador: `residuo === 0 ? 0 : 10 - residuo`.
  - Rechaza documentos falsos o con dígito manipulado con código `CEDULA_INVALID_CHECKSUM` (HTTP 422).
- **Registro Nacional del Contribuyente DGII (Módulo 11)**:
  - Longitud exacta: 9 dígitos numéricos para personas jurídicas.
  - Multiplicadores posicionales: `[7, 9, 8, 6, 5, 4, 3, 2]`.
  - Tratamiento de residuos especiales: `residuo === 0 -> 2`, `residuo === 1 -> 1`, en otros casos `11 - residuo`.
- **Estructura Oficial de Cuentas Contables**:
  - Expresión regular institucional: `^[1-9]-[0-9]{2}-[0-9]{2}-[0-9]{4}$` (formato `X-XX-XX-XXXX`).
  - Validación de incompatibilidad: La cuenta de compra y la cuenta de depreciación acumulada de un mismo tipo de activo no pueden ser idénticas.

### 6.3 Module Error Codes (RFC 7807)
| Error Code | HTTP Status | Root Cause | System Action / User Feedback |
|------------|-------------|------------|-------------------------------|
| VALIDATION_ERROR | 400 Bad Request | Payload no supera el esquema Zod | Retorna listado de campos inválidos con mensajes en español. |
| UNAUTHORIZED | 401 Unauthorized | Petición sin token de sesión activo | Redirección a /login con parámetro callbackUrl. |
| FORBIDDEN | 403 Forbidden | Sesión carece del permiso RBAC requerido | Operación rechazada: Acceso denegado. Permisos insuficientes. |
| ACCOUNT_LOCKED | 429 Too Many Requests | Cuenta temporalmente bloqueada por fuerza bruta | Operación bloqueada con tiempo de espera restante en segundos. |
| USER_NOT_FOUND | 404 Not Found | Identificador de usuario inexistente | Retorna mensaje: El usuario solicitado no existe. |
| EMAIL_ALREADY_EXISTS | 409 Conflict | Intento de registrar un correo ya registrado | Rechazo: El correo institucional ya se encuentra registrado. |
| DEPARTMENT_CODE_DUPLICATE | 409 Conflict | Código institucional de departamento duplicado | Rechazo: El código de departamento ya está en uso. |
| DEPT_HAS_ACTIVE_EMPLOYEES | 400 Bad Request | Intento de eliminar departamento con empleados | Rechazo: No se puede eliminar un departamento con colaboradores activos. |
| ASSET_TYPE_CODE_DUPLICATE | 409 Conflict | Código institucional de tipo de activo duplicado | Rechazo: El código de tipo de activo ya está en uso. |
| ASSET_TYPE_ACCOUNTS_MATCH | 400 Bad Request | Cuenta compra igual a cuenta depreciación | Rechazo: Las cuentas contables de compra y depreciación no pueden ser iguales. |
| CEDULA_INVALID_CHECKSUM | 422 Unprocessable | Dígito verificador JCE Módulo 10 incorrecto | Rechazo: El documento de identidad no superó la validación oficial JCE. |
| EMPLOYEE_CEDULA_DUPLICATE | 409 Conflict | Cédula ya registrada en otro colaborador | Rechazo: Ya existe un colaborador con este documento de identidad. |
| EMPLOYEE_IS_DEPARTMENT_HEAD | 400 Bad Request | Baja de empleado que figura como jefe de depto | Rechazo: El colaborador es titular de departamento. Reasigne la titularidad antes de proceder. |

---

## 7. External Integrations
- **NextAuth.js v5 Beta**: Proveedor de credenciales institucional con sesiones JWT encriptadas en cookies HttpOnly y SameSite Lax.
- **ExcelJS**: Generación nativa de libros `.xlsx` con estilos corporativos UNAPEC y auto-ajuste de columnas.
- **Preámbulo UTF-8 BOM (`\uFEFF`)**: Emisión determinista en archivos `.csv` para compatibilidad inmediata con Microsoft Excel en Windows.
- **Contabilidad General UNAPEC (Futuro Sub-04)**: Integración REST con el Web Service de Finanzas de UNAPEC para asentar comprobantes contables diarios y mensuales.

---

## 8. Audit Trail & Security Policy
- **Acciones Auditadas Inmutables**: Inicio de sesión exitoso y fallido, bloqueo y desbloqueo de cuenta, creación de usuarios, mutación de roles, altas, modificaciones y bajas de catálogos base (Departamentos, Tipos de Activos, Empleados).
- **Campos de Traza**: usuario_id, ip_address, user_agent, accion, recurso, timestamp_utc.

---

## 9. Change Log & Spec Lineage

| Date | Sub-module / Spec | Milestone Summary | Git Commit | Author / Approver |
|------|-------------------|-------------------|------------|-------------------|
| 2026-10-13 | specs/activos-fijos/00-autenticacion-rbac | Certificación formal del Sub-módulo 00: Arquitectura RBAC relacional, autenticación NextAuth v5, suites completas Vitest (92.7%) y Playwright E2E (4/4). | 246837a | Dirección de Tecnología / SDD Build Agent |
| 2026-10-15 | specs/activos-fijos/01-catalogos-base | Certificación formal del Sub-módulo 01: Catálogos Base (Departamentos, Tipos de Activos DGII, Custodios JCE Módulo 10, exportación Excel/CSV), suite Vitest 100% (123 tests) y suite E2E Playwright 100% (9 tests). | 458ee12 | Dirección de Tecnología & Finanzas / SDD Build Agent |