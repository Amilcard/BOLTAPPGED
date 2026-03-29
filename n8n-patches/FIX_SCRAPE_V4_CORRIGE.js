// ============================================================
// Scrape Toutes Sessions UFOVAL — v4.1 CORRIGE
// FIX: erreurs loggees au lieu de skip silencieux
// FIX: compteur errors[] pour diagnostic
// ============================================================

const MOIS_FR = {
  'janv': 1, 'fevr': 2, 'mars': 3, 'avr': 4, 'avri': 4,
  'mai': 5, 'juin': 6, 'juil': 7, 'aout': 8,
  'sept': 9, 'octo': 10, 'oct': 10, 'nov': 11, 'nove': 11, 'dec': 12, 'dece': 12
};

function parseDate(text) {
  const clean = text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche/gi, '')
      .replace(/\./g, '').trim();
  const match = clean.match(/(\d{1,2})\s+([a-z]+)/);
  if (!match) return null;
  const day = parseInt(match[1]);
  const monthStr = match[2].substring(0, 4);
  const month = MOIS_FR[monthStr] || MOIS_FR[match[2]];
  if (!month) return null;
  return { day, month };
}

function parseSessionsFromHtml(html, duration, year) {
  const sessions = [];
  const labelMatches = html.match(/<label[^>]*>[\s\S]*?<\/label>/gi) || [];
  for (const label of labelMatches) {
    const stripped = label.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!stripped.includes(' au ')) continue;
    const isFull = label.includes('availability-status-full') || label.includes('Complet');
    const parts = stripped.split(/ au /i);
    if (parts.length >= 2) {
      const start = parseDate(parts[0]);
      const end = parseDate(parts[1]);
      if (start && end) {
        sessions.push({
            start_date: year + '-' + String(start.month).padStart(2, '0') + '-' + String(start.day).padStart(2, '0'),
            end_date: year + '-' + String(end.month).padStart(2, '0') + '-' + String(end.day).padStart(2, '0'),
            is_full: isFull,
            duration: duration
        });
      }
    }
  }
  return sessions;
}

function extractCookies(headers) {
  const sc = headers && headers['set-cookie'];
  if (Array.isArray(sc)) return sc.map(c => c.split(';')[0]).join('; ');
  if (typeof sc === 'string') return sc.split(';')[0];
  return '';
}

// === MAIN ===
const output = [];
const targetYear = new Date().getFullYear();

for (const item of $input.all()) {
  const slug = item.json.slug;
  const sourceUrl = item.json.source_url;
  if (!sourceUrl) {
    output.push({ json: { slug, error: 'No source_url', sessions: [] } });
    continue;
  }

  // STEP 1: GET avec returnFullResponse pour capturer les cookies
  let pageHtml, cookies;
  try {
    const resp = await this.helpers.httpRequest({
      method: 'GET', url: sourceUrl, json: false, returnFullResponse: true
    });
    pageHtml = String(resp.body);
    cookies = extractCookies(resp.headers);
  } catch (e) {
    output.push({ json: { slug, error: 'GET failed: ' + e.message, sessions: [] } });
    continue;
  }

  // STEP 2: Extraire form action + CSRF token + durees
  const faMatch = pageHtml.match(/action="(\/fr\/stay\/\d+\/update-availabilities-cart-form)"/i);
  const tkMatch = pageHtml.match(/name="stay_duration\[_token\]"\s+value="([^"]+)"/i);
  const durRegex = /<option\s+value="(\d+)"[^>]*>\d+\s*jours?<\/option>/gi;
  const durations = [];
  let dm;
  while ((dm = durRegex.exec(pageHtml)) !== null) durations.push(parseInt(dm[1]));
  const defMatch = pageHtml.match(/<option\s+value="(\d+)"[^>]*selected/i);
  const defaultDuration = defMatch ? parseInt(defMatch[1]) : -1;

  // STEP 3: Parser toutes les durees
  const allSessions = [];
  const errors = [];

  // 3a: Duree par defaut (dans le HTML GET)
  allSessions.push(...parseSessionsFromHtml(pageHtml, defaultDuration, targetYear));

  // 3b: Autres durees via POST AJAX avec cookies
  if (faMatch && tkMatch && durations.length > 0) {
    const formAction = 'https://ufoval.fol74.org' + faMatch[1];
    const csrfToken = tkMatch[1];

    for (const dur of durations) {
      if (dur === defaultDuration) continue;
      try {
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest'
        };
        if (cookies) headers['Cookie'] = cookies;

        const response = await this.helpers.httpRequest({
          method: 'POST', url: formAction, headers,
          body: 'stay_duration[duration]=' + dur + '&stay_duration[_token]=' + encodeURIComponent(csrfToken),
          json: false
        });

        // Reponse = objet {html:...} ou string JSON
        let htmlContent = '';
        if (typeof response === 'object' && response && response.html) {
          htmlContent = response.html;
        } else if (typeof response === 'string') {
          try { htmlContent = JSON.parse(response).html || ''; } catch(e) { htmlContent = response; }
        }

        if (htmlContent) {
          allSessions.push(...parseSessionsFromHtml(htmlContent, dur, targetYear));
        }
      } catch (e) {
        // FIX v4.1: Logger l'erreur au lieu de skip silencieux
        errors.push('POST dur=' + dur + ': ' + e.message);
      }
    }
  } else {
    // Log si extraction form/token a echoue
    if (!faMatch) errors.push('formAction non trouve dans HTML');
    if (!tkMatch) errors.push('csrfToken non trouve dans HTML');
    if (durations.length === 0) errors.push('aucune duree trouvee dans HTML');
  }

  output.push({
    json: {
      slug,
      totalSessions: allSessions.length,
      fullSessions: allSessions.filter(s => s.is_full).length,
      sessions: allSessions,
      // FIX v4.1: exposer les erreurs pour diagnostic
      errors: errors.length > 0 ? errors : undefined,
      debug: {
        hasCookies: !!cookies,
        hasFormAction: !!faMatch,
        hasCsrfToken: !!tkMatch,
        durationsFound: durations.length,
        defaultDuration: defaultDuration
      }
    }
  });

  await new Promise(r => setTimeout(r, 500));
}

output.push({
  json: {
    _summary: true,
    totalSejours: output.length,
    totalSessionsFound: output.reduce((a, b) => a + (b.json.totalSessions || 0), 0),
    totalFullFound: output.reduce((a, b) => a + (b.json.fullSessions || 0), 0),
    sejoursWithErrors: output.filter(o => o.json.errors && o.json.errors.length > 0).map(o => o.json.slug)
  }
});

await new Promise(r => setTimeout(r, 1000));

return output;
