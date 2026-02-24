
/**
 * Appar Script-proxy för att hämta och parsa fonddata till klienten (undviker CORS).
 * Publicera som webbapp: Deploy → New deployment → Web app → Execute as Me → Anyone has access.
 */

function doGet(e){
  const params = e.parameter || {};
  const source = params.source;
  try{
    if(source === 'ft'){
      const isin = params.isin; // t.ex. LU0122376428 eller FRNRX
      if(!isin) return json({error:'missing isin'});
      const url = `https://markets.ft.com/data/funds/tearsheet/performance?s=${encodeURIComponent(isin)}`;
      const html = UrlFetchApp.fetch(url, {muteHttpExceptions:true, followRedirects:true}).getContentText();
      const perf = parseFT(html);
      return json({perf, source:"ft", isin});
    }
    if(source === 'fm'){
      const url = params.url; // t.ex. fondmarknaden-sida
      if(!url) return json({error:'missing url'});
      const html = UrlFetchApp.fetch(url, {muteHttpExceptions:true, followRedirects:true}).getContentText();
      const perf = parseFondmarknaden(html);
      return json({perf, source:"fm", url});
    }
    return json({error:'unknown source'});
  }catch(err){
    return json({error: String(err)});
  }
}

function json(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseFT(html){
  // Grov regex letar efter rad med 5y, 3y, 1y, 6m, 3m, 1m procentsiffror
  // Ex: "+19.98% +7.15% +15.85% +25.64% +14.44% +13.49%"
  const m = html.match(/([+\-]?\d{1,3}\.\d{2})%\s+([+\-]?\d{1,3}\.\d{2})%\s+([+\-]?\d{1,3}\.\d{2})%\s+([+\-]?\d{1,3}\.\d{2})%\s+([+\-]?\d{1,3}\.\d{2})%\s+([+\-]?\d{1,3}\.\d{2})%/);
  if(!m) return {};
  // Index: 1=5y,2=3y,3=1y,4=6m,5=3m,6=1m (vanligt i FT-tabellerna)
  const perf = {
    '1m': parseFloat(m[6]),
    '3m': parseFloat(m[5]),
    '1y': parseFloat(m[3]),
    '3y': parseFloat(m[2])
  };
  // 2 år finns sällan – lämna tomt. 5y ignoreras här.
  return perf;
}

function parseFondmarknaden(html){
  // Letar efter mönster som "6,77% 1 mån"/"30,74% 3 mån" etc.
  function find(label){
    const re = new RegExp('(\n|\r|\s)([\+\-]?\d{1,3}[\.,]\d{1,2})%\\s*'+label.replace(' ','\\s*'), 'i');
    const m = html.match(re);
    if(!m) return null;
    return parseFloat(m[2].replace(',','.'));
  }
  const perf = {
    '1m': find('1 mån'),
    '3m': find('3 mån'),
    '1y': find('1 år'),
    '3y': find('3 år')
  };
  return perf;
}
