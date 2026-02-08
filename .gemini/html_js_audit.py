import os
import re
import json
from pathlib import Path

# Percorsi base
PUBLIC_DIR = r"c:\Users\Diego\OneDrive - BM SERVICE S.R.L\BM Service srl\Desktop_Veggiano\Progetti\AppCodiciPassword\Frontend\public"
JS_DIR = os.path.join(PUBLIC_DIR, "assets", "js")

# Struttura attuale dei file JS
JS_STRUCTURE = {
    "core": [
        "assets/js/auth.js",
        "assets/js/base-config.js",
        "assets/js/cleanup.js",
        "assets/js/components.js",
        "assets/js/core.js",
        "assets/js/db.js",
        "assets/js/dom-utils.js",
        "assets/js/firebase-config.js",
        "assets/js/gestione_allegati.js",
        "assets/js/inactivity-timer.js",
        "assets/js/main.js",
        "assets/js/notification_service.js",
        "assets/js/swipe-list-v6.js",
        "assets/js/tailwind-config.js",
        "assets/js/theme.js",
        "assets/js/translations.js",
        "assets/js/ui-components.js",
        "assets/js/ui-core.js",
        "assets/js/ui-pages.js",
        "assets/js/uid.js",
        "assets/js/utils.js"
    ],
    "modules": {
        "auth": [
            "assets/js/modules/auth/imposta_nuova_password.js",
            "assets/js/modules/auth/login.js",
            "assets/js/modules/auth/registrati.js",
            "assets/js/modules/auth/reset_password.js"
        ],
        "azienda": [
            "assets/js/modules/azienda/account_azienda.js",
            "assets/js/modules/azienda/account_azienda_list.js",
            "assets/js/modules/azienda/aggiungi_account_azienda.js",
            "assets/js/modules/azienda/aggiungi_azienda.js",
            "assets/js/modules/azienda/dati_azienda.js",
            "assets/js/modules/azienda/dettaglio_account_azienda.js",
            "assets/js/modules/azienda/form_account_azienda.js",
            "assets/js/modules/azienda/lista_aziende.js",
            "assets/js/modules/azienda/modifica_account_azienda.js",
            "assets/js/modules/azienda/modifica_azienda.js"
        ],
        "core": [
            "assets/js/modules/core/security-setup.js"
        ],
        "home": [
            "assets/js/modules/home/home.js"
        ],
        "privato": [
            "assets/js/modules/privato/account_privati.js",
            "assets/js/modules/privato/area_privata.js",
            "assets/js/modules/privato/dati_anagrafici_privato.js",
            "assets/js/modules/privato/dettaglio_account_privato.js",
            "assets/js/modules/privato/form_account_privato.js",
            "assets/js/modules/privato/profilo_privato.js"
        ],
        "scadenze": [
            "assets/js/modules/scadenze/aggiungi_scadenza.js",
            "assets/js/modules/scadenze/configurazione_automezzi.js",
            "assets/js/modules/scadenze/configurazione_documenti.js",
            "assets/js/modules/scadenze/configurazione_generali.js",
            "assets/js/modules/scadenze/dettaglio_scadenza.js",
            "assets/js/modules/scadenze/modifica_scadenza.js",
            "assets/js/modules/scadenze/scadenza_templates.js",
            "assets/js/modules/scadenze/scadenze.js"
        ],
        "settings": [
            "assets/js/modules/settings/archivio_account.js",
            "assets/js/modules/settings/impostazioni.js",
            "assets/js/modules/settings/notifiche_storia.js",
            "assets/js/modules/settings/privacy.js"
        ]
    }
}

def extract_script_tags(html_file):
    """Estrae tutti i tag <script> da un file HTML"""
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern per trovare tag script con src
    pattern = r'<script[^>]*src=["\']([^"\']+)["\'][^>]*>'
    scripts = re.findall(pattern, content)
    
    # Pattern per script inline
    inline_pattern = r'<script[^>]*>(?!.*src=).*?</script>'
    inline_scripts = re.findall(inline_pattern, content, re.DOTALL)
    
    return scripts, inline_scripts

def check_file_exists(script_path, base_dir):
    """Verifica se il file JavaScript esiste"""
    # Rimuovi query string
    clean_path = script_path.split('?')[0]
    full_path = os.path.join(base_dir, clean_path)
    return os.path.exists(full_path), full_path

def analyze_html_files():
    """Analizza tutti i file HTML"""
    results = {
        "total_html": 0,
        "total_scripts": 0,
        "total_inline": 0,
        "files": {},
        "errors": [],
        "warnings": []
    }
    
    # Trova tutti i file HTML
    html_files = []
    for root, dirs, files in os.walk(PUBLIC_DIR):
        for file in files:
            if file.endswith('.html'):
                html_files.append(os.path.join(root, file))
    
    results["total_html"] = len(html_files)
    
    for html_file in html_files:
        rel_path = os.path.relpath(html_file, PUBLIC_DIR)
        scripts, inline = extract_script_tags(html_file)
        
        file_info = {
            "path": rel_path,
            "scripts": [],
            "inline_count": len(inline),
            "status": "OK",
            "issues": []
        }
        
        results["total_scripts"] += len(scripts)
        results["total_inline"] += len(inline)
        
        # Analizza ogni script
        for script in scripts:
            script_info = {
                "src": script,
                "exists": False,
                "full_path": ""
            }
            
            exists, full_path = check_file_exists(script, PUBLIC_DIR)
            script_info["exists"] = exists
            script_info["full_path"] = full_path
            
            if not exists:
                file_info["status"] = "ERROR"
                error_msg = f"❌ {rel_path}: Script non trovato '{script}'"
                file_info["issues"].append(error_msg)
                results["errors"].append(error_msg)
            
            file_info["scripts"].append(script_info)
        
        # Controlla script inline
        if len(inline) > 0:
            file_info["status"] = "WARNING" if file_info["status"] == "OK" else file_info["status"]
            warning_msg = f"⚠️  {rel_path}: Contiene {len(inline)} script inline"
            file_info["issues"].append(warning_msg)
            results["warnings"].append(warning_msg)
        
        results["files"][rel_path] = file_info
    
    return results

def generate_report(results):
    """Genera un report dettagliato"""
    report = []
    report.append("=" * 80)
    report.append("REPORT ANALISI HTML-JS COLLEGAMENTI")
    report.append("=" * 80)
    report.append("")
    report.append(f"📊 STATISTICHE GENERALI")
    report.append(f"   • File HTML analizzati: {results['total_html']}")
    report.append(f"   • Tag <script> totali: {results['total_scripts']}")
    report.append(f"   • Script inline trovati: {results['total_inline']}")
    report.append(f"   • Errori trovati: {len(results['errors'])}")
    report.append(f"   • Warning trovati: {len(results['warnings'])}")
    report.append("")
    report.append("=" * 80)
    report.append("")
    
    # Raggruppa per stato
    ok_files = []
    warning_files = []
    error_files = []
    
    for filename, info in sorted(results["files"].items()):
        if info["status"] == "ERROR":
            error_files.append((filename, info))
        elif info["status"] == "WARNING":
            warning_files.append((filename, info))
        else:
            ok_files.append((filename, info))
    
    # Sezione ERRORI
    if error_files:
        report.append("🔴 ERRORI CRITICI - SCRIPT NON TROVATI")
        report.append("=" * 80)
        for filename, info in error_files:
            report.append(f"\n📄 {filename}")
            report.append(f"   Status: {info['status']}")
            for issue in info["issues"]:
                if "❌" in issue:
                    report.append(f"   {issue.split(': ', 1)[1]}")
            report.append(f"   Script referenziati:")
            for script in info["scripts"]:
                status_icon = "✅" if script["exists"] else "❌"
                report.append(f"      {status_icon} {script['src']}")
        report.append("")
    
    # Sezione WARNING
    if warning_files:
        report.append("🟡 WARNING - SCRIPT INLINE O ALTRI PROBLEMI")
        report.append("=" * 80)
        for filename, info in warning_files:
            report.append(f"\n📄 {filename}")
            report.append(f"   Status: {info['status']}")
            if info["inline_count"] > 0:
                report.append(f"   ⚠️  Script inline: {info['inline_count']}")
            report.append(f"   Script referenziati:")
            for script in info["scripts"]:
                status_icon = "✅" if script["exists"] else "❌"
                report.append(f"      {status_icon} {script['src']}")
        report.append("")
    
    # Sezione OK
    if ok_files:
        report.append("🟢 FILE OK - NESSUN PROBLEMA")
        report.append("=" * 80)
        for filename, info in ok_files:
            report.append(f"\n📄 {filename}")
            report.append(f"   Script referenziati: {len(info['scripts'])}")
            for script in info["scripts"]:
                report.append(f"      ✅ {script['src']}")
        report.append("")
    
    report.append("=" * 80)
    report.append("FINE REPORT")
    report.append("=" * 80)
    
    return "\n".join(report)

if __name__ == "__main__":
    print("🔍 Avvio analisi HTML-JS collegamenti...")
    results = analyze_html_files()
    report = generate_report(results)
    
    # Salva report
    report_file = os.path.join(PUBLIC_DIR, "HTML_JS_AUDIT_REPORT.md")
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(report)
    print(f"\n✅ Report salvato in: {report_file}")
    
    # Salva anche JSON per analisi programmatica
    json_file = os.path.join(PUBLIC_DIR, "HTML_JS_AUDIT_REPORT.json")
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Dati JSON salvati in: {json_file}")
