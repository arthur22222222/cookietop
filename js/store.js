/* ===========================================================
   Cookie's Top — camada de dados
   Persistência em localStorage, vendas, estoque e lucro.
   Valores monetários são guardados em centavos (inteiros).
   =========================================================== */

(function (global) {
  'use strict';

  var STORAGE_KEY = 'cookiestop:v1';

  var DEFAULT_FLAVORS = [
    { id: 'tradicional', name: 'Tradicional', emoji: '🍪', price: 0, cost: 0, stock: 16, min: 4 },
    { id: 'nutella', name: 'Nutella', emoji: '🍫', price: 0, cost: 0, stock: 16, min: 4 },
    { id: 'redvelvet', name: 'Red Velvet', emoji: '🧁', price: 0, cost: 0, stock: 16, min: 4 },
    { id: 'brookie', name: 'Brookie', emoji: '🥧', price: 0, cost: 0, stock: 16, min: 4 },
    { id: 'sorvete', name: 'Sorvete', emoji: '🍦', price: 0, cost: 0, stock: 16, min: 4, addon: true }
  ];

  var PAYMENTS = ['Dinheiro', 'Pix', 'Débito', 'Crédito'];

  var state = null;

  /* ---------- utilidades ---------- */

  function toInt(value) {
    var n = Math.round(Number(value));
    return Number.isFinite(n) ? n : 0;
  }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function blankState() {
    return {
      version: 1,
      storeName: "Cookie's Top",
      createdAt: new Date().toISOString(),
      setupSeen: false,
      configured: false,
      flavors: DEFAULT_FLAVORS.map(function (f) { return Object.assign({}, f); }),
      sales: [],
      movements: []
    };
  }

  function normalizeSale(raw) {
    var items = Array.isArray(raw.items) ? raw.items.map(function (item) {
      return {
        flavorId: String(item.flavorId || ''),
        name: String(item.name || ''),
        qty: Math.max(0, toInt(item.qty)),
        unitPrice: Math.max(0, toInt(item.unitPrice)),
        unitCost: Math.max(0, toInt(item.unitCost)),
        addon: !!item.addon
      };
    }) : [];

    return {
      id: String(raw.id || uid('sale')),
      date: raw.date || new Date().toISOString(),
      items: items,
      discount: Math.max(0, toInt(raw.discount)),
      total: toInt(raw.total),
      cost: toInt(raw.cost),
      profit: toInt(raw.profit),
      payment: PAYMENTS.indexOf(raw.payment) >= 0 ? raw.payment : (raw.payment || 'Pix'),
      note: String(raw.note || ''),
      canceled: !!raw.canceled,
      canceledAt: raw.canceledAt || null
    };
  }

  function normalizeMovement(raw) {
    return {
      id: String(raw.id || uid('mv')),
      date: raw.date || new Date().toISOString(),
      flavorId: String(raw.flavorId || ''),
      type: raw.type || 'ajuste',
      qty: toInt(raw.qty),
      note: String(raw.note || '')
    };
  }

  function normalize(raw) {
    var base = blankState();
    if (!raw || typeof raw !== 'object') return base;

    var flavors = base.flavors.map(function (def) {
      var found = Array.isArray(raw.flavors) ? raw.flavors.find(function (f) {
        return f && f.id === def.id;
      }) : null;
      if (!found) return def;

      var savedName = (typeof found.name === 'string' && found.name.trim()) ? found.name.trim() : def.name;
      if (def.addon && savedName === 'Sorvete com Cookie') savedName = def.name;

      return {
        id: def.id,
        addon: !!def.addon,
        name: savedName,
        emoji: (typeof found.emoji === 'string' && found.emoji.trim()) ? found.emoji.trim() : def.emoji,
        price: Math.max(0, toInt(found.price)),
        cost: Math.max(0, toInt(found.cost)),
        stock: Math.max(0, toInt(found.stock)),
        min: Math.max(0, toInt(found.min))
      };
    });

    var sales = Array.isArray(raw.sales) ? raw.sales.filter(function (s) {
      return s && s.id && Array.isArray(s.items);
    }).map(normalizeSale) : [];

    var movements = Array.isArray(raw.movements) ? raw.movements.filter(function (m) {
      return m && m.id;
    }).map(normalizeMovement) : [];

    return {
      version: 1,
      storeName: (typeof raw.storeName === 'string' && raw.storeName.trim()) ? raw.storeName.trim() : base.storeName,
      createdAt: raw.createdAt || base.createdAt,
      setupSeen: !!raw.setupSeen,
      configured: !!raw.configured,
      flavors: flavors,
      sales: sales,
      movements: movements
    };
  }

  /* ---------- persistência ---------- */

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      console.error("[Cookie's Top] Não foi possível salvar os dados:", err);
      return false;
    }
  }

  function load() {
    var raw = null;
    try {
      raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (err) {
      raw = null;
    }
    state = normalize(raw);
    if (raw === null) persist();
    return state;
  }

  /* ---------- formatos ---------- */

  function brl(cents) {
    var n = (Number(cents) || 0) / 100;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function parseMoney(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Math.max(0, Math.round(value * 100)) : 0;
    }
    var text = String(value == null ? '' : value).trim().replace(/\s/g, '').replace(/R\$/gi, '');
    if (!text) return 0;
    text = text.replace(/[^0-9,.-]/g, '');
    if (text.indexOf(',') >= 0) {
      text = text.replace(/\./g, '').replace(',', '.');
    }
    var n = parseFloat(text);
    return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0;
  }

  /* ---------- consultas ---------- */

  function findFlavor(id) {
    for (var i = 0; i < state.flavors.length; i++) {
      if (state.flavors[i].id === id) return state.flavors[i];
    }
    return null;
  }

  function salesBetween(from, to) {
    var start = from instanceof Date ? from.getTime() : Number(from);
    var end = to instanceof Date ? to.getTime() : Number(to);
    return state.sales.filter(function (sale) {
      var time = new Date(sale.date).getTime();
      return time >= start && time < end;
    });
  }

  function summary(sales) {
    var active = (sales || []).filter(function (s) { return !s.canceled; });
    var revenue = 0, cost = 0, profit = 0, units = 0, addons = 0;

    active.forEach(function (sale) {
      revenue += sale.total;
      cost += sale.cost;
      profit += sale.profit;
      sale.items.forEach(function (item) {
        if (item.addon) addons += item.qty;
        else units += item.qty;
      });
    });

    var count = active.length;
    return {
      revenue: revenue,
      cost: cost,
      profit: profit,
      units: units,
      addons: addons,
      count: count,
      ticket: count ? Math.round(revenue / count) : 0,
      margin: revenue ? (profit / revenue) * 100 : 0
    };
  }

  function addMovement(flavorId, type, qty, note) {
    state.movements.push({
      id: uid('mv'),
      date: new Date().toISOString(),
      flavorId: flavorId,
      type: type,
      qty: qty,
      note: note || ''
    });
  }

  /* ---------- mutações ---------- */

  function addSale(payload) {
    payload = payload || {};
    var items = Array.isArray(payload.items) ? payload.items : [];

    var merged = new Map();
    items.forEach(function (item) {
      var flavor = item && findFlavor(item.flavorId);
      if (!flavor) return;
      var qty = Math.max(0, Math.floor(Number(item.qty) || 0));
      merged.set(flavor.id, (merged.get(flavor.id) || 0) + qty);
    });

    var lines = [];
    var entries = Array.from(merged.entries());
    for (var i = 0; i < entries.length; i++) {
      var flavorId = entries[i][0];
      var qtyWanted = entries[i][1];
      var flavor = findFlavor(flavorId);
      if (!flavor || qtyWanted < 1) continue;
      if (flavor.price <= 0) {
        return { ok: false, error: 'Defina o preço de "' + flavor.name + '" antes de vender.' };
      }
      if (qtyWanted > flavor.stock) {
        return {
          ok: false,
          error: 'Estoque insuficiente de ' + flavor.name + ': ' + flavor.stock + ' un. disponíveis.'
        };
      }
      lines.push({ flavor: flavor, qty: qtyWanted });
    }

    if (!lines.length) return { ok: false, error: 'Adicione ao menos um item ao pedido.' };

    var saleItems = lines.map(function (line) {
      return {
        flavorId: line.flavor.id,
        name: line.flavor.name,
        qty: line.qty,
        unitPrice: line.flavor.price,
        unitCost: line.flavor.cost,
        addon: !!line.flavor.addon
      };
    });

    var subtotal = saleItems.reduce(function (acc, item) {
      return acc + item.unitPrice * item.qty;
    }, 0);

    var discount = Math.min(Math.max(0, toInt(payload.discount)), subtotal);
    var total = subtotal - discount;
    var cost = saleItems.reduce(function (acc, item) {
      return acc + item.unitCost * item.qty;
    }, 0);
    var profit = total - cost;

    var sale = {
      id: uid('sale'),
      date: new Date().toISOString(),
      items: saleItems,
      discount: discount,
      total: total,
      cost: cost,
      profit: profit,
      payment: PAYMENTS.indexOf(payload.payment) >= 0 ? payload.payment : 'Pix',
      note: String(payload.note || ''),
      canceled: false,
      canceledAt: null
    };

    lines.forEach(function (line) {
      line.flavor.stock -= line.qty;
      addMovement(line.flavor.id, 'venda', -line.qty, 'Venda de ' + line.qty + ' un.');
    });

    state.sales.push(sale);
    persist();
    return { ok: true, sale: sale };
  }

  function cancelSale(id) {
    var sale = null;
    for (var i = 0; i < state.sales.length; i++) {
      if (state.sales[i].id === id) { sale = state.sales[i]; break; }
    }
    if (!sale) return { ok: false, error: 'Venda não encontrada.' };
    if (sale.canceled) return { ok: false, error: 'Esta venda já foi cancelada.' };

    sale.items.forEach(function (item) {
      var flavor = findFlavor(item.flavorId);
      if (!flavor) return;
      flavor.stock += item.qty;
      addMovement(flavor.id, 'cancelamento', item.qty, 'Cancelamento de venda');
    });

    sale.canceled = true;
    sale.canceledAt = new Date().toISOString();
    persist();
    return { ok: true, sale: sale };
  }

  function addStock(flavorId, qty, note) {
    var flavor = findFlavor(flavorId);
    if (!flavor) return { ok: false, error: 'Sabor não encontrado.' };

    var amount = Math.floor(Number(qty));
    if (!Number.isFinite(amount) || amount < 1) {
      return { ok: false, error: 'Informe uma quantidade igual ou maior que 1.' };
    }

    flavor.stock += amount;
    addMovement(flavor.id, 'entrada', amount, note || 'Entrada de estoque');
    persist();
    return { ok: true, flavor: flavor };
  }

  function setStock(flavorId, qty, note) {
    var flavor = findFlavor(flavorId);
    if (!flavor) return { ok: false, error: 'Sabor não encontrado.' };

    var amount = Math.floor(Number(qty));
    if (!Number.isFinite(amount) || amount < 0) {
      return { ok: false, error: 'Informe uma quantidade válida.' };
    }

    var diff = amount - flavor.stock;
    if (diff === 0) return { ok: false, error: 'O estoque já está nessa quantidade.' };

    flavor.stock = amount;
    addMovement(flavor.id, 'ajuste', diff, note || 'Ajuste manual de estoque');
    persist();
    return { ok: true, flavor: flavor };
  }

  function applyFlavorPatch(id, patch) {
    var flavor = findFlavor(id);
    if (!flavor || !patch) return;

    if (patch.name !== undefined) {
      var name = String(patch.name).trim();
      if (name) flavor.name = name;
    }
    if (patch.emoji !== undefined) {
      var emoji = String(patch.emoji).trim();
      if (emoji) flavor.emoji = emoji.slice(0, 4);
    }
    if (patch.price !== undefined) flavor.price = Math.max(0, toInt(patch.price));
    if (patch.cost !== undefined) flavor.cost = Math.max(0, toInt(patch.cost));
    if (patch.min !== undefined) flavor.min = Math.max(0, Math.floor(Number(patch.min) || 0));
  }

  function refreshConfigured() {
    state.configured = state.flavors.every(function (f) { return f.price > 0; });
  }

  function updateFlavor(id, patch) {
    var flavor = findFlavor(id);
    if (!flavor) return { ok: false, error: 'Sabor não encontrado.' };
    applyFlavorPatch(id, patch);
    refreshConfigured();
    persist();
    return { ok: true, flavor: flavor };
  }

  function updateFlavors(entries) {
    (entries || []).forEach(function (entry) {
      if (entry && entry.id) applyFlavorPatch(entry.id, entry);
    });
    refreshConfigured();
    persist();
    return { ok: true };
  }

  function updateSettings(patch) {
    patch = patch || {};
    if (patch.storeName !== undefined) {
      var name = String(patch.storeName).trim();
      if (name) state.storeName = name;
    }
    persist();
    return { ok: true };
  }

  function setSetupSeen() {
    state.setupSeen = true;
    persist();
    return { ok: true };
  }

  /* ---------- backup ---------- */

  function exportJSON() {
    return JSON.stringify(state, null, 2);
  }

  function importJSON(text) {
    var parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return { ok: false, error: 'Arquivo inválido: não é um JSON válido.' };
    }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.flavors)) {
      return { ok: false, error: 'Este arquivo não parece ser um backup da Cookie\'s Top.' };
    }
    state = normalize(parsed);
    persist();
    return { ok: true };
  }

  function resetAll() {
    state = blankState();
    persist();
    return { ok: true };
  }

  function csvCell(value) {
    var text = String(value == null ? '' : value).replace(/"/g, '""');
    return '"' + text + '"';
  }

  function exportCSV(sales) {
    var rows = [['Data', 'Hora', 'Itens', 'Pagamento', 'Desconto', 'Total', 'Custo', 'Lucro', 'Status']];

    (sales || []).slice().sort(function (a, b) {
      return new Date(a.date) - new Date(b.date);
    }).forEach(function (sale) {
      var when = new Date(sale.date);
      var items = sale.items.map(function (item) {
        return item.qty + 'x ' + item.name;
      }).join(' + ');

      rows.push([
        when.toLocaleDateString('pt-BR'),
        when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        items,
        sale.payment,
        (sale.discount / 100).toFixed(2).replace('.', ','),
        (sale.total / 100).toFixed(2).replace('.', ','),
        (sale.cost / 100).toFixed(2).replace('.', ','),
        (sale.profit / 100).toFixed(2).replace('.', ','),
        sale.canceled ? 'Cancelada' : 'Concluída'
      ]);
    });

    return '\uFEFF' + rows.map(function (row) {
      return row.map(csvCell).join(';');
    }).join('\r\n');
  }

  /* ---------- planilha (.xlsx) ---------- */
  /* Gera um arquivo Excel de verdade (várias abas) sem biblioteca externa,
     para continuar funcionando offline. Um .xlsx é um ZIP com XMLs. */

  var X_HEADER = 1, X_MONEY = 2, X_DATE = 3, X_PERCENT = 4;

  function xmlEscape(value) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function colName(index) {
    var name = '';
    var n = index + 1;
    while (n > 0) {
      var rest = (n - 1) % 26;
      name = String.fromCharCode(65 + rest) + name;
      n = Math.floor((n - 1) / 26);
    }
    return name;
  }

  function xMoney(cents) { return { v: (Number(cents) || 0) / 100, s: X_MONEY }; }
  function xPercent(fraction) { return { v: Number(fraction) || 0, s: X_PERCENT }; }

  function xDate(iso) {
    var d = new Date(iso);
    var t = d.getTime();
    if (!isFinite(t)) return String(iso || '');
    /* hora local do aparelho -> número de data do Excel */
    return { v: (t - d.getTimezoneOffset() * 60000) / 86400000 + 25569, s: X_DATE };
  }

  function cellXml(ref, cell, isHeader) {
    if (cell == null || cell === '') return '';
    if (typeof cell === 'object') {
      return '<c r="' + ref + '" s="' + cell.s + '"><v>' + cell.v + '</v></c>';
    }
    if (typeof cell === 'number') {
      return Number.isFinite(cell) ? '<c r="' + ref + '"><v>' + cell + '</v></c>' : '';
    }
    return '<c r="' + ref + '"' + (isHeader ? ' s="' + X_HEADER + '"' : '') +
      ' t="inlineStr"><is><t xml:space="preserve">' + xmlEscape(cell) + '</t></is></c>';
  }

  function sheetXml(rows, widths, plain) {
    var cols = (widths || []).map(function (w, i) {
      return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
    }).join('');

    var data = rows.map(function (row, r) {
      var cells = row.map(function (cell, c) {
        return cellXml(colName(c) + (r + 1), cell, r === 0);
      }).join('');
      return '<row r="' + (r + 1) + '">' + cells + '</row>';
    }).join('');

    var lastCol = colName(Math.max(0, (rows[0] || []).length - 1));
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0">' +
      (plain ? '' : '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>') +
      '</sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>' +
      (cols ? '<cols>' + cols + '</cols>' : '') +
      '<sheetData>' + data + '</sheetData>' +
      (plain ? '' : '<autoFilter ref="A1:' + lastCol + Math.max(1, rows.length) + '"/>') +
      '</worksheet>';
  }

  var STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/>' +
    '<numFmt numFmtId="165" formatCode="dd/mm/yyyy\\ hh:mm"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF5C1A2B"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="5">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  var CRC_TABLE = (function () {
    var table = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* ZIP sem compressão (método "stored"): simples e aceito pelo Excel. */
  function zipStore(files) {
    var encoder = new TextEncoder();
    var now = new Date();
    var dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    var parts = [];
    var central = [];
    var offset = 0;

    files.forEach(function (file) {
      var name = encoder.encode(file.name);
      var data = encoder.encode(file.content);
      var crc = crc32(data);

      var local = new Uint8Array(30 + name.length);
      var lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, name.length, true);
      lv.setUint16(28, 0, true);
      local.set(name, 30);
      parts.push(local, data);

      var entry = new Uint8Array(46 + name.length);
      var ev = new DataView(entry.buffer);
      ev.setUint32(0, 0x02014b50, true);
      ev.setUint16(4, 20, true);
      ev.setUint16(6, 20, true);
      ev.setUint16(8, 0x0800, true);
      ev.setUint16(10, 0, true);
      ev.setUint16(12, dosTime, true);
      ev.setUint16(14, dosDate, true);
      ev.setUint32(16, crc, true);
      ev.setUint32(20, data.length, true);
      ev.setUint32(24, data.length, true);
      ev.setUint16(28, name.length, true);
      ev.setUint32(42, offset, true);
      entry.set(name, 46);
      central.push(entry);

      offset += local.length + data.length;
    });

    var centralSize = central.reduce(function (acc, entry) { return acc + entry.length; }, 0);
    var end = new Uint8Array(22);
    var dv = new DataView(end.buffer);
    dv.setUint32(0, 0x06054b50, true);
    dv.setUint16(8, files.length, true);
    dv.setUint16(10, files.length, true);
    dv.setUint32(12, centralSize, true);
    dv.setUint32(16, offset, true);

    var all = parts.concat(central, [end]);
    var total = all.reduce(function (acc, chunk) { return acc + chunk.length; }, 0);
    var out = new Uint8Array(total);
    var pos = 0;
    all.forEach(function (chunk) { out.set(chunk, pos); pos += chunk.length; });
    return out;
  }

  var MOVEMENT_LABELS = { entrada: 'Entrada', ajuste: 'Ajuste', venda: 'Venda', cancelamento: 'Cancelamento' };

  function exportXLSX() {
    var byDate = function (a, b) { return new Date(a.date) - new Date(b.date); };
    var sales = state.sales.slice().sort(byDate);
    var statusOf = function (sale) { return sale.canceled ? 'Cancelada' : 'Concluída'; };

    var salesRows = [['Data e hora', 'Itens', 'Pagamento', 'Desconto', 'Total', 'Custo', 'Lucro', 'Status', 'Observação']];
    sales.forEach(function (sale) {
      salesRows.push([
        xDate(sale.date),
        sale.items.map(function (item) { return item.qty + 'x ' + item.name; }).join(' + '),
        sale.payment,
        xMoney(sale.discount), xMoney(sale.total), xMoney(sale.cost), xMoney(sale.profit),
        statusOf(sale),
        sale.note
      ]);
    });

    var itemRows = [['Data e hora', 'Produto', 'Tipo', 'Quantidade', 'Preço unitário', 'Custo unitário', 'Subtotal', 'Lucro (sem desconto)', 'Pagamento', 'Status']];
    sales.forEach(function (sale) {
      sale.items.forEach(function (item) {
        var flavor = findFlavor(item.flavorId);
        var isAddon = item.addon || (flavor && flavor.addon);
        itemRows.push([
          xDate(sale.date), item.name, isAddon ? 'Sorvete' : 'Cookie', item.qty,
          xMoney(item.unitPrice), xMoney(item.unitCost),
          xMoney(item.unitPrice * item.qty), xMoney((item.unitPrice - item.unitCost) * item.qty),
          sale.payment, statusOf(sale)
        ]);
      });
    });

    var stockRows = [['Produto', 'Tipo', 'Preço de venda', 'Custo', 'Margem (R$)', 'Margem (%)', 'Estoque (un.)', 'Estoque mínimo', 'Situação']];
    state.flavors.forEach(function (f) {
      stockRows.push([
        f.emoji + ' ' + f.name,
        f.addon ? 'Sorvete' : 'Cookie',
        xMoney(f.price), xMoney(f.cost),
        xMoney(f.price - f.cost),
        f.price > 0 ? xPercent((f.price - f.cost) / f.price) : '',
        f.stock, f.min,
        f.stock <= 0 ? 'Esgotado' : (f.stock <= f.min ? 'Estoque baixo' : 'Ok')
      ]);
    });

    var moveRows = [['Data e hora', 'Produto', 'Tipo', 'Quantidade', 'Observação']];
    state.movements.slice().sort(byDate).forEach(function (m) {
      var flavor = findFlavor(m.flavorId);
      moveRows.push([
        xDate(m.date), flavor ? flavor.name : 'Produto removido',
        MOVEMENT_LABELS[m.type] || m.type, m.qty, m.note
      ]);
    });

    var sum = summary(state.sales);
    var canceled = state.sales.filter(function (sl) { return sl.canceled; }).length;
    var cookieStock = state.flavors.reduce(function (acc, f) { return f.addon ? acc : acc + f.stock; }, 0);
    var addonStock = state.flavors.reduce(function (acc, f) { return f.addon ? acc + f.stock : acc; }, 0);
    var summaryRows = [
      ['Indicador', 'Valor'],
      ['Loja', state.storeName],
      ['Gerado em', xDate(new Date().toISOString())],
      ['Vendas concluídas', sum.count],
      ['Vendas canceladas', canceled],
      ['Faturamento', xMoney(sum.revenue)],
      ['Custo', xMoney(sum.cost)],
      ['Lucro', xMoney(sum.profit)],
      ['Ticket médio', xMoney(sum.ticket)],
      ['Margem de lucro', xPercent(sum.margin / 100)],
      ['Cookies vendidos', sum.units],
      ['Sorvetes vendidos', sum.addons],
      ['Estoque de cookies (un.)', cookieStock],
      ['Estoque de sorvete (un.)', addonStock]
    ];

    var sheets = [
      { name: 'Vendas', rows: salesRows, widths: [17, 44, 12, 12, 12, 12, 12, 12, 28] },
      { name: 'Itens vendidos', rows: itemRows, widths: [17, 24, 11, 11, 14, 14, 12, 20, 12, 12] },
      { name: 'Estoque', rows: stockRows, widths: [26, 11, 14, 12, 13, 12, 13, 15, 14] },
      { name: 'Movimentações', rows: moveRows, widths: [17, 24, 14, 12, 40] },
      { name: 'Resumo', rows: summaryRows, widths: [30, 22], plain: true }
    ];

    var files = [];
    files.push({
      name: '[Content_Types].xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        sheets.map(function (sh, i) {
          return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        }).join('') +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>'
    });
    files.push({
      name: '_rels/.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>'
    });
    files.push({
      name: 'xl/workbook.xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets>' + sheets.map(function (sh, i) {
          return '<sheet name="' + xmlEscape(sh.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
        }).join('') + '</sheets></workbook>'
    });
    files.push({
      name: 'xl/_rels/workbook.xml.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map(function (sh, i) {
          return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
        }).join('') +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>'
    });
    files.push({ name: 'xl/styles.xml', content: STYLES_XML });
    sheets.forEach(function (sh, i) {
      files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', content: sheetXml(sh.rows, sh.widths, sh.plain) });
    });

    return zipStore(files);
  }

  /* ---------- API ---------- */

  var Store = {
    load: load,
    persist: persist,
    brl: brl,
    parseMoney: parseMoney,
    getFlavor: findFlavor,
    salesBetween: salesBetween,
    summary: summary,
    addSale: addSale,
    cancelSale: cancelSale,
    addStock: addStock,
    setStock: setStock,
    updateFlavor: updateFlavor,
    updateFlavors: updateFlavors,
    updateSettings: updateSettings,
    setSetupSeen: setSetupSeen,
    exportJSON: exportJSON,
    importJSON: importJSON,
    resetAll: resetAll,
    exportCSV: exportCSV,
    exportXLSX: exportXLSX,
    PAYMENTS: PAYMENTS
  };

  Object.defineProperty(Store, 'state', {
    get: function () { return state; }
  });

  global.Store = Store;
})(window);
