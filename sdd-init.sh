#!/usr/bin/env bash
# sdd-init.sh - Instala SDD Standard en un proyecto para cualquier IDE
#
# Uso interactivo (default):
#   bash sdd-init.sh
#
# Uso no-interactivo (CI):
#   bash sdd-init.sh --ide opencode --org mi-org --project mi-proyecto --non-interactive
#
# Flags:
#   --ide <name>          IDE objetivo (default: opencode)
#   --org <name>          Organizacion Azure DevOps
#   --project <name>      Proyecto en ADO
#   --non-interactive     Modo CI, requiere args via flags
#   --force               Sobrescribir
#   --help                Ayuda

set -e
export PYTHONUTF8=1

# Auto-fix CRLF (Windows curl downloads)
if grep -qP '\r$' "$0" 2>/dev/null; then
  sed -i 's/\r$//' "$0"
  exec bash "$0" "$@"
fi

# --- Banner ---
echo ""
echo "======================================================"
echo "  SDD Standard - Instalacion"
echo "======================================================"
echo ""

# --- Prerequisites ---
echo "Verificando prerequisitos..."

if ! command -v npx &>/dev/null; then
  echo "   ERROR: npx no encontrado. Instala Node.js 20+: https://nodejs.org/"
  exit 1
fi

if ! command -v git &>/dev/null; then
  echo "   ERROR: git no encontrado. Instala Git: https://git-scm.com/"
  exit 1
fi

echo "   OK Node: $(node --version 2>&1)"
echo "   OK Git: $(git --version 2>&1)"
echo ""

# --- Git identity check (configure if missing) ---
GIT_USER=$(git config user.name 2>/dev/null || echo "")
GIT_EMAIL=$(git config user.email 2>/dev/null || git config --global user.email 2>/dev/null || echo "")

if [ -z "$GIT_USER" ] || [ -z "$GIT_EMAIL" ]; then
  echo "Git identity not configured."
  if [ "$NON_INTERACTIVE" = false ]; then
    if [ -z "$GIT_USER" ]; then
      read -p "  Your name (ej: Juan Solano): " GIT_USER
      git config user.name "$GIT_USER"
      echo "   OK git user.name configured"
    fi
    if [ -z "$GIT_EMAIL" ]; then
      read -p "  Your email (ej: jsolano@unipago.com.do): " GIT_EMAIL
      git config user.email "$GIT_EMAIL"
      echo "   OK git user.email configured"
    fi
    echo ""
  else
    echo "ERROR: Git identity not configured. Set it with:"
    echo "  git config user.name 'Your Name'"
    echo "  git config user.email 'your@email.com'"
    exit 1
  fi
fi

# --- Defaults ---
IDE=""
ORG=""
PROJECT=""
NON_INTERACTIVE=false
FORCE=false
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Parse args ---
while [[ $# -gt 0 ]]; do
  case $1 in
    --ide)             IDE="$2"; shift 2 ;;
    --org)             ORG="$2"; shift 2 ;;
    --project)         PROJECT="$2"; shift 2 ;;
    --non-interactive) NON_INTERACTIVE=true; shift ;;
    --force)           FORCE=true; shift ;;
    --help|-h)
      echo "Uso: bash sdd-init.sh [flags]"
      echo ""
      echo "Flags:"
      echo "  --ide <name>          IDE objetivo (default: opencode)"
      echo "  --org <name>          Organizacion Azure DevOps (opcional)"
      echo "  --project <name>      Proyecto en ADO (opcional)"
      echo "  --non-interactive     Modo CI, requiere args via flags"
      echo "  --force               Sobrescribir"
      echo "  --help                Esta ayuda"
      echo ""
      echo "Interactivo (default):"
      echo "  bash sdd-init.sh"
      exit 0 ;;
    *) echo "ERROR: Argument?to desconocido: $1"; exit 1 ;;
  esac
done

# --- Interactive prompts ---
if [ "$NON_INTERACTIVE" = false ]; then
  # IDE
  if [ -z "$IDE" ]; then
    echo "  Que IDE usas?"
    echo "    [1] opencode (default)"
    echo "    [2] Kiro (proximamente)"
    echo "    [3] Claude Code (proximamente)"
    echo "    [4] Antigravity (proximamente)"
    echo ""
    read -p "  Selecciona (1-4): " IDE_CHOICE
    case "$IDE_CHOICE" in
      2) IDE="kiro" ;;
      3) IDE="claude" ;;
      4) IDE="antigravity" ;;
      *) IDE="opencode" ;;
    esac
    echo ""
  fi

  # Org (opcional)
  if [ -z "$ORG" ]; then
    read -p "  Organizacion Azure DevOps (ENTER para omitir / modo local): " ORG
    echo ""
  fi

  # Project (solo si se especifico organizacion)
  if [ -n "$ORG" ] && [ -z "$PROJECT" ]; then
    read -p "  Proyecto en Azure DevOps (ENTER para omitir): " PROJECT
    echo ""
  fi
fi

# --- Credentials (ask only if .sdd-credentials.json missing or --force) ---
CREDENTIALA_PAT=""
GITHUB_PAT=""
STITCH_KEY=""
NEEDS_CREDENTIALS=false

if [ ! -f ".sdd-credentials.json" ] || [ "$FORCE" = true ]; then
  NEEDS_CREDENTIALS=true
fi

if [ "$NEEDS_CREDENTIALS" = true ] && [ "$NON_INTERACTIVE" = false ]; then
  echo "Configuracion de credenciales:"
  echo ""

  # ADO PAT (solo si hay organizacion)
  if [ -n "$ORG" ]; then
    echo "  Azure DevOps PAT (dev.azure.com -> Settings -> Tokens)"
    read -p "  Pega tu PAT (ENTER para omitir): " ADO_PAT
    echo ""
    ADO_PAT=$(echo "$ADO_PAT" | tr -d '[:cntrl:]')

    if [ -z "$ADO_PAT" ]; then
      echo "  WARNING: PAT vacio. Azure DevOps MCP no funcionara sin PAT."
    else
      echo "   OK PAT de Azure DevOps configurado"
    fi
    echo ""
  fi

  # GitHub PAT (optional)
  read -p "  GitHub PAT (ENTER para omitir): " GITHUB_PAT
  GITHUB_PAT=$(echo "$GITHUB_PAT" | tr -d '[:cntrl:]')
  [ -n "$GITHUB_PAT" ] && echo "   OK GitHub PAT configurado"
  echo ""

  # Stitch API Key (optional)
  read -p "  Stitch API Key (ENTER para omitir): " STITCH_KEY
  STITCH_KEY=$(echo "$STITCH_KEY" | tr -d '[:cntrl:]')
  [ -n "$STITCH_KEY" ] && echo "   OK Stitch API Key configurado"
  echo ""
elif [ "$NEEDS_CREDENTIALS" = false ]; then
  echo "Credentials already configured (use --force to reconfigure)"
  echo ""
fi

# --- Validar ---
if [ -z "$IDE" ]; then
  IDE="opencode"
fi

if [ -z "$ORG" ]; then
  echo "   INFO: Sin organizacion Azure DevOps (Modo Local / Standalone)."
fi

# --- Download core/ and adapters/ from repo if not present locally ---
SDD_REPO="https://github.com/JeremyJS20/sdd-standard-light.git"
NEEDS_DOWNLOAD=false

if [ ! -d "$SCRIPT_DIR/core" ] || [ ! -d "$SCRIPT_DIR/adapters" ]; then
  NEEDS_DOWNLOAD=true
fi

if [ "$NEEDS_DOWNLOAD" = true ]; then
  echo "Downloading SDD Standard from repo..."
  TMP_DOWNLOAD=$(mktemp -d 2>/dev/null || echo "/tmp/sdd-download-$$")
  git clone --depth 1 "$SDD_REPO" "$TMP_DOWNLOAD" 2>&1 | tail -1
  if [ ! -d "$TMP_DOWNLOAD/core" ]; then
    echo "ERROR: Could not download SDD Standard from $SDD_REPO"
    rm -rf "$TMP_DOWNLOAD"
    exit 1
  fi
  if [ ! -d "$SCRIPT_DIR/core" ]; then
    cp -r "$TMP_DOWNLOAD/core" "$SCRIPT_DIR/core"
  fi
  if [ ! -d "$SCRIPT_DIR/adapters" ]; then
    cp -r "$TMP_DOWNLOAD/adapters" "$SCRIPT_DIR/adapters"
  fi
  rm -rf "$TMP_DOWNLOAD"
  echo "   OK SDD Standard downloaded"
  echo ""
fi

# Validar que el adapter existe
ADAPTER="$SCRIPT_DIR/adapters/$IDE/adapter.sh"
if [ ! -f "$ADAPTER" ]; then
  echo "ERROR: IDE '$IDE' no soportado. Adapter no encontrado: $ADAPTER"
  echo "   IDEs disponibles: $(ls "$SCRIPT_DIR/adapters/" 2>/dev/null | tr '\n' ' ')"
  exit 1
fi

# Validar que core/ existe
if [ ! -d "$SCRIPT_DIR/core" ]; then
  echo "ERROR: core/ no encontrado en $SCRIPT_DIR"
  exit 1
fi

# --- Protect secrets FIRST (before any credential file is written) ---
# Files that contain PATs / API keys. NEVER committed.
SECRET_FILES=(
  "opencode.json"
  ".kiro/settings/mcp.json"
  ".mcp.json"
  ".claude/mcp.json"
  ".agents/mcp_config.json"
  ".sdd-credentials.json"
  ".env"
  ".env.local"
  ".env.*.local"
)
GITIGNORE_ENTRIES=("${SECRET_FILES[@]}" ".sdd-memory/" ".sdd-cache/")

touch .gitignore
# Ensure the file ends with a newline so the first appended entry is not glued to the last line
if [ -s .gitignore ] && [ -n "$(tail -c 1 .gitignore)" ]; then
  echo "" >> .gitignore
fi
# Exact line match (-x): ".env" must not be considered present just because ".env.example" exists
for entry in "${GITIGNORE_ENTRIES[@]}"; do
  if ! tr -d '\r' < .gitignore | grep -qxF "$entry"; then
    echo "$entry" >> .gitignore
  fi
done

# Untrack secret files committed by older installs (keeps the local file)
if [ -d ".git" ]; then
  for f in "${SECRET_FILES[@]}"; do
    if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
      git rm --cached --quiet "$f"
      echo "   WARNING: $f estaba trackeado en git — removido del indice (archivo local intacto)."
      echo "            Si ya fue pusheado, ROTA los tokens: siguen en el historial de git."
    fi
  done
fi
echo "   OK .gitignore protege credenciales (MCP configs, .sdd-credentials.json, .env)"
echo ""

# --- Generate PAT64 and save credentials ---
if [ "$NEEDS_CREDENTIALS" = true ] && [ -n "$ADO_PAT" ]; then
  # PAT64 = base64(email:pat)
  PAT64=$(echo -n "${GIT_EMAIL}:${ADO_PAT}" | base64 -w 0 2>/dev/null || echo -n "${GIT_EMAIL}:${ADO_PAT}" | base64)

  cat > .sdd-credentials.json << CRED_EOF
{
  "AZURE_DEVOPS_PAT": "$ADO_PAT",
  "AZURE_DEVOPS_PAT_B64": "$PAT64",
  "AZURE_DEVOPS_EMAIL": "$GIT_EMAIL",
  "GITHUB_PAT": "$GITHUB_PAT",
  "STITCH_API_KEY": "$STITCH_KEY"
}
CRED_EOF
  echo "   OK .sdd-credentials.json generated (PAT64 = base64(email:pat))"
elif [ -f ".sdd-credentials.json" ]; then
  # Load existing credentials for adapter
  PAT64=$(grep '"AZURE_DEVOPS_PAT_B64"' .sdd-credentials.json 2>/dev/null | sed 's/.*: *"//;s/".*//' | tr -d '\r')
  GITHUB_PAT=$(grep '"GITHUB_PAT"' .sdd-credentials.json 2>/dev/null | sed 's/.*: *"//;s/".*//' | tr -d '\r')
  STITCH_KEY=$(grep '"STITCH_API_KEY"' .sdd-credentials.json 2>/dev/null | sed 's/.*: *"//;s/".*//' | tr -d '\r')
fi

# --- Resumen ---
echo "Configuracion:"
echo "   IDE:          $IDE"
echo "   Organizacion: ${ORG:-'(ninguna - modo local)'}"
echo "   Proyecto:     ${PROJECT:-'(ninguno)'}"
echo "   Force:        $FORCE"
echo ""

# --- 1. Crear directorios base ---
echo "Creando estructura de directorios..."

if [ "$IDE" = "opencode" ]; then
  IDE_DIR=".opencode"
  mkdir -p .opencode/rules .opencode/agents .opencode/skills
elif [ "$IDE" = "kiro" ]; then
  IDE_DIR=".kiro"
  mkdir -p .kiro/steering .kiro/powers .kiro/agents .kiro/settings
elif [ "$IDE" = "claude" ]; then
  IDE_DIR=".claude"
  mkdir -p .claude/agents .claude/commands .claude/rules
elif [ "$IDE" = "antigravity" ]; then
  IDE_DIR=".agents"
  mkdir -p .agents/agents .agents/skills
fi

echo "   OK Directorios creados ($IDE_DIR)"

# --- 2. Copiar core/ al proyecto ---
echo "Copiando archivos core/..."

# Copiar rules
if [ -d "$SCRIPT_DIR/core/rules" ]; then
  COPY_FLAG="-n"
  if [ "$FORCE" = true ]; then
    COPY_FLAG="-f"
  fi

  if [ "$IDE" = "opencode" ]; then
    cp $COPY_FLAG "$SCRIPT_DIR/core/rules/"*.md .opencode/rules/ 2>/dev/null || true
  elif [ "$IDE" = "kiro" ]; then
    cp $COPY_FLAG "$SCRIPT_DIR/core/rules/"*.md .kiro/steering/ 2>/dev/null || true
  elif [ "$IDE" = "claude" ]; then
    cp $COPY_FLAG "$SCRIPT_DIR/core/rules/"*.md .claude/rules/ 2>/dev/null || true
  elif [ "$IDE" = "antigravity" ]; then
    echo "   SKIP rules copy (adapter handles skills conversion)"
  fi
  RULES_COUNT=$(ls -1 "$SCRIPT_DIR/core/rules/"*.md 2>/dev/null | wc -l)
  echo "   OK Rules: $RULES_COUNT archivos"
fi

# Copiar agents
if [ -d "$SCRIPT_DIR/core/agents" ]; then
  if [ "$IDE" = "opencode" ]; then
    cp $COPY_FLAG "$SCRIPT_DIR/core/agents/"*.md .opencode/agents/ 2>/dev/null || true
  elif [ "$IDE" = "kiro" ]; then
    cp $COPY_FLAG "$SCRIPT_DIR/core/agents/"*.md .kiro/agents/ 2>/dev/null || true
  elif [ "$IDE" = "claude" ]; then
    cp $COPY_FLAG "$SCRIPT_DIR/core/agents/"*.md .claude/agents/ 2>/dev/null || true
  elif [ "$IDE" = "antigravity" ]; then
    echo "   SKIP agents copy (adapter generates Gemini-format agents)"
  fi
  AGENTS_COUNT=$(ls -1 "$SCRIPT_DIR/core/agents/"*.md 2>/dev/null | wc -l)
  echo "   OK Agents: $AGENTS_COUNT archivos"
fi

# Copiar templates y crear directorios de docs
mkdir -p specs/_templates docs/architecture docs/modules
if [ -d "$SCRIPT_DIR/core/templates" ]; then
  cp $COPY_FLAG "$SCRIPT_DIR/core/templates/"*.md specs/_templates/ 2>/dev/null || true
  TEMPLATES_COUNT=$(ls -1 "$SCRIPT_DIR/core/templates/"*.md 2>/dev/null | wc -l)
  echo "   OK Templates: $TEMPLATES_COUNT archivos"
fi

# --- 3. Ejecutar adapter del IDE ---
echo ""
echo "Ejecutando adapter para $IDE..."
bash "$ADAPTER" --org "$ORG" --project "$PROJECT" --ide-dir "$IDE_DIR" --script-dir "$SCRIPT_DIR" --pat64 "$PAT64" --github-pat "$GITHUB_PAT" --stitch-key "$STITCH_KEY" ${FORCE:+--force}
echo "   OK Adapter completado"

# --- 4. Crear .sdd-memory/ ---
mkdir -p .sdd-memory
touch .sdd-memory/memory.jsonl
echo "   OK .sdd-memory/ creado"

# --- 5. Crear .sdd-config.json ---
if [ ! -f ".sdd-config.json" ] || [ "$FORCE" = true ]; then
  HOST_TYPE="azure"
  if [ -z "$ORG" ]; then
    HOST_TYPE="none"
  fi

  cat > .sdd-config.json << CONFIG_EOF
{
  "role": "developer",
  "ides": ["$IDE"],
  "spec_prefix": "AB#",
  "app_dir": "",
  "host": "$HOST_TYPE",
  "project_host": "$HOST_TYPE",
  "azure_devops_org": "$ORG",
  "azure_devops_project": "$PROJECT",
  "wi_states": {
    "start": "To Do",
    "working": "In Progress",
    "pr_created": "Fixed",
    "testing": "In Testing",
    "done": "Done",
    "reopen": "Reopen",
    "hold": "On Hold",
    "defer": "Fix Later",
    "acceptance": "Acceptance",
    "test_passed": "Test Passed",
    "qa_passed": "QA Passed"
  },
  "wi_types": {
    "feature": "Feature",
    "bug": "Bug",
    "requirement": "User Story",
    "data": "Data Dictionary",
    "structure": "Structure",
    "rule": "Business Rule",
    "pbi": "Product Backlog Item",
    "e2e_scenario": "E2E Scenario"
  },
  "versioning": {
    "strategy": "semver",
    "source": "git-tag",
    "version_file": true,
    "initial_version": "1.0.0"
  },
  "environments": {
    "local": { "url": "", "start_command": "" },
    "dev":   { "branch": "develop", "url": "" },
    "qa":    { "branch": "qa",      "url": "" },
    "prod":  { "branch": "main",    "url": "" }
  }
}
CONFIG_EOF
  echo "   OK .sdd-config.json generado"
else
  echo "   SKIP .sdd-config.json ya existe (usa --force)"
fi

# --- 6. Crear .env.example ---
cat > .env.example << 'ENV_EOF'
# Azure DevOps (requerido)
AZURE_DEVOPS_PAT=

# GitHub (opcional, dual CI/CD)
GITHUB_PAT=

# Stitch (opcional, generacion de UI)
STITCH_API_KEY=
ENV_EOF
echo "   OK .env.example generado"

# --- 7. Re-verificar .gitignore ---
# Las entradas principales ya se protegieron al inicio del script.
for entry in "${GITIGNORE_ENTRIES[@]}"; do
  if ! tr -d '\r' < .gitignore 2>/dev/null | grep -qxF "$entry"; then
    echo "$entry" >> .gitignore
  fi
done
echo "   OK .gitignore verificado (MCP configs y credenciales protegidos)"

# --- 8. Crear specs/ si no existe ---
if [ -d "specs" ] && ! [ "$FORCE" = true ]; then
  echo "   SKIP specs/ ya existe (contenido preservado)"
else
  mkdir -p specs
  echo "   OK specs/ creado"
fi

# --- 9. Git commit de archivos SDD (como sdd-sync.sh) ---
if [ -d ".git" ]; then
  echo ""
  echo "Committing standard files..."

  # Check git identity
  GIT_USER=$(git config user.name 2>/dev/null || echo "")
  GIT_EMAIL=$(git config user.email 2>/dev/null || git config --global user.email 2>/dev/null || echo "")

  # Build list of dirs/files to commit (team-shared, NOT gitignored)
  COMMIT_DIRS="$IDE_DIR specs .sdd-config.json .env.example .gitignore sdd-init.sh"

  # Add each item individually, skip silently if doesn't exist
  for item in $COMMIT_DIRS; do
    [ -e "$item" ] && git add "$item" 2>/dev/null || true
  done

  # Safety guard: ensure NO secret, credential, or MCP config file is staged under any circumstances
  for sec in "${SECRET_FILES[@]}"; do
    git rm --cached --quiet "$sec" 2>/dev/null || true
  done

  # Check if there's anything staged
  STAGED=$(git diff --cached --name-only 2>/dev/null | head -1)
  if [ -z "$STAGED" ]; then
    echo "   SKIP No hay cambios para commitear"
  else
    # Commit with error handling
    if [ -n "$GIT_USER" ] && [ -n "$GIT_EMAIL" ]; then
      COMMIT_MSG="chore: initial SDD standard setup"
      if git rev-parse HEAD >/dev/null 2>&1; then
        COMMIT_MSG="chore: update SDD standard"
      fi
      if git commit --no-verify -m "$COMMIT_MSG" 2>/dev/null; then
        echo "   OK Standard files committed: $COMMIT_MSG"
      else
        echo "   ERROR: git commit fallo. Cambios staged pero no commiteados."
        echo "   Ejecuta manualmente: git commit -m '$COMMIT_MSG'"
      fi
    else
      # No git identity — commit with generic author
      COMMIT_MSG="chore: initial SDD standard setup"
      if git rev-parse HEAD >/dev/null 2>&1; then
        COMMIT_MSG="chore: update SDD standard"
      fi
      if git commit --no-verify --author="SDD Init <sdd-init@local>" -m "$COMMIT_MSG" 2>/dev/null; then
        echo "   OK Standard files committed (author: SDD Init)"
        echo "   INFO: Configura git identity y haz amend si lo deseas:"
        echo "      git config --global user.name 'Tu Nombre'"
        echo "      git config --global user.email 'tu@empresa.com'"
        echo "      git commit --amend --reset-author --no-edit"
      else
        echo "   ERROR: git commit fallo incluso con author generico."
        echo "   Ejecuta manualmente: git commit -m '$COMMIT_MSG'"
      fi
    fi
  fi
else
  echo "   SKIP No es un repo git -- init git primero si deseas commit"
fi

# --- 10. Cleanup: remover archivos de instalacion ---
rm -rf core/ adapters/
echo "   OK core/ y adapters/ removidos (solo queda sdd-init.sh)"

# --- Resumen final ---
echo ""
echo "======================================================"
echo "  SDD Standard instalado"
echo "======================================================"
echo ""
echo "Archivos generados:"
echo "   - Config del IDE ($IDE)"
echo "   - $IDE_DIR/rules/ (14 steering rules)"
echo "   - $IDE_DIR/agents/ (2 agentes)"
echo "   - specs/_templates/ (3 templates)"
echo "   - .sdd-memory/ (server-memory store)"
echo "   - .sdd-config.json (config del proyecto)"
echo "   - .env.example (variables de entorno)"
echo "   - specs/ (directorio de artefactos)"
echo ""
echo "Proximos pasos:"
echo "   1. cp .env.example .env -> llena AZURE_DEVOPS_PAT"
echo ""
echo "   codebase-memory (instalacion global, una sola vez):"
echo "   npm i -g codebase-memory-mcp"
echo "   codebase-memory-mcp install"
echo "   codebase-memory-mcp config set auto_index true"
echo ""
echo "   2. Abre tu IDE (opencode)"
echo "   3. El agente leera Azure DevOps automaticamente"
echo ""
