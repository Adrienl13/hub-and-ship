#!/bin/bash
# update-progress.sh
# Met à jour PROGRESS.md depuis le Git log
# Usage : npm run update-progress
#        ou : ./scripts/update-progress.sh

set -e

PROGRESS_FILE="PROGRESS.md"
LAST_UPDATE_FILE=".last-progress-update"
DATE=$(date +"%Y-%m-%d %H:%M")

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📊 Mise à jour PROGRESS.md...${NC}"

# Vérifier qu'on est dans un repo Git
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Pas dans un repo Git${NC}"
    exit 1
fi

# Récupérer les commits depuis dernier update (ou tous si premier passage)
if [ -f "$LAST_UPDATE_FILE" ]; then
    LAST_COMMIT=$(cat "$LAST_UPDATE_FILE")
    COMMITS=$(git log --oneline --since="$(stat -c %y "$LAST_UPDATE_FILE" 2>/dev/null || stat -f %Sm -t %Y-%m-%d "$LAST_UPDATE_FILE")" --pretty=format:"%h - %s (%an, %ar)" 2>/dev/null || git log --oneline -20 --pretty=format:"%h - %s (%an, %ar)")
else
    echo -e "${YELLOW}⚠️  Premier passage, lecture des 20 derniers commits${NC}"
    COMMITS=$(git log --oneline -20 --pretty=format:"%h - %s (%an, %ar)")
fi

# Compter les commits par type (Conventional Commits)
FEAT_COUNT=$(echo "$COMMITS" | grep -c "feat" || true)
FIX_COUNT=$(echo "$COMMITS" | grep -c "fix" || true)
TEST_COUNT=$(echo "$COMMITS" | grep -c "test" || true)
REFACTOR_COUNT=$(echo "$COMMITS" | grep -c "refactor" || true)
DOCS_COUNT=$(echo "$COMMITS" | grep -c "docs" || true)
CHORE_COUNT=$(echo "$COMMITS" | grep -c "chore" || true)

# Stats tests
TESTS_COUNT=$(find tests -name "*.test.ts" 2>/dev/null | wc -l | tr -d ' ' || echo 0)
COMPONENTS_COUNT=$(find src/components -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ' || echo 0)
LIB_COUNT=$(find src/lib -name "*.ts" 2>/dev/null | wc -l | tr -d ' ' || echo 0)

# Files récemment modifiés
RECENT_FILES=$(git diff --name-only HEAD~5..HEAD 2>/dev/null | head -10 || echo "")

# Génère le rapport
REPORT=$(cat <<EOF

### Session du $DATE

**Commits depuis dernière update** :
- ✨ Feat : $FEAT_COUNT
- 🐛 Fix : $FIX_COUNT
- 🧪 Test : $TEST_COUNT
- ♻️ Refactor : $REFACTOR_COUNT
- 📝 Docs : $DOCS_COUNT
- 🔧 Chore : $CHORE_COUNT

**Liste commits récents** :
\`\`\`
$COMMITS
\`\`\`

**Stats projet** :
- Tests : $TESTS_COUNT fichiers
- Composants : $COMPONENTS_COUNT fichiers
- Lib métier : $LIB_COUNT fichiers

**Fichiers récemment modifiés** :
\`\`\`
$RECENT_FILES
\`\`\`

---
EOF
)

# Insertion dans PROGRESS.md à l'emplacement du marqueur
if [ -f "$PROGRESS_FILE" ]; then
    if grep -q "## 📝 Journal des sessions Claude Code" "$PROGRESS_FILE"; then
        # Position après le titre journal, avant la première session existante
        TEMP_FILE=$(mktemp)
        awk -v report="$REPORT" '
        /## 📝 Journal des sessions Claude Code/ {
            print
            getline
            print
            print report
            next
        }
        { print }
        ' "$PROGRESS_FILE" > "$TEMP_FILE"
        mv "$TEMP_FILE" "$PROGRESS_FILE"
        echo -e "${GREEN}✅ PROGRESS.md mis à jour${NC}"
    else
        echo -e "${YELLOW}⚠️  Marqueur '## 📝 Journal des sessions' non trouvé${NC}"
        echo -e "${YELLOW}   Rapport ajouté en fin de fichier${NC}"
        echo "$REPORT" >> "$PROGRESS_FILE"
    fi
else
    echo -e "${RED}❌ PROGRESS.md introuvable${NC}"
    exit 1
fi

# Sauvegarder le dernier commit pour prochain run
git rev-parse HEAD > "$LAST_UPDATE_FILE"

# Suggestions de tâches à marquer comme terminées
echo ""
echo -e "${BLUE}💡 Suggestions de tâches potentiellement terminées${NC}"
echo -e "${BLUE}   (analyser les commits et marquer ✅ manuellement) :${NC}"
echo ""

if [ "$FEAT_COUNT" -gt 0 ]; then
    echo "   Commits feat détectés : vérifie quelles features sont à marquer ✅"
fi

if [ "$TEST_COUNT" -gt 0 ]; then
    echo "   Commits test détectés : vérifie quels tests sont à marquer ✅"
fi

echo ""
echo -e "${GREEN}Done. N'oublie pas de :${NC}"
echo -e "   1. Relire PROGRESS.md et marquer ✅ les tâches terminées"
echo -e "   2. Commit : git add PROGRESS.md && git commit -m 'docs(progress): update session log'"
echo ""
