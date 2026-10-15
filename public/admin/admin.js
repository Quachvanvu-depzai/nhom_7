/* Trang quản trị NhàTrọ+: ADMIN thấy toàn hệ thống; chủ tòa nhà (MANAGER) chỉ thấy dữ liệu của tòa nhà mình (server lọc). */
(async function () {
  const { el, $, clear } = UI;
  const { me } = await Layout.init('');
  const view = $('#view'), side = $('#side');
  if (!me) { location.replace('/login.html?next=/admin/index.html'); return; }
  if (me.role !== 'ADMIN' && me.role !== 'MANAGER') { location.replace('/'); return; }
  const isAdmin = me.role === 'ADMIN';
  const srcCache = {};
  const confirmBox = (t) => window.confirm(t);
  const statusText = (list, v) => { const o = list && list.find((x) => x.v === v); return o ? o.t : v; };

  // ---------- nguồn dữ liệu cho ô chọn ----------
  async function fetchSrc(name, q) {
    const s = ADMIN_SRC[name];
    const r = await Api.get(s.url, q ? { q } : undefined);
    const list = Array.isArray(r) ? r : r.items;
    return list.map((x) => ({ v: x[s.id], t: x[s.label], raw: x }));
  }
  async function loadSrc(name) { return srcCache[name] || (srcCache[name] = await fetchSrc(name)); }

  // ---------- tải ảnh lên ----------
  function uploader(initial, max) {
    let urls = (initial || []).slice();
    const grid = el('div', { class: 'upload-grid' });
    const file = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/gif,image/webp', multiple: true, class: 'hidden' });
    const msg = el('div', { class: 'muted' });
    const add = el('button', { type: 'button', class: 'up-add', text: '＋ Tải ảnh' });
    function draw() {
      clear(grid);
      urls.forEach((u, i) => grid.appendChild(el('div', { class: 'up-item' + (i === 0 ? ' cover' : '') }, el('img', { src: UI.safeUrl(u), alt: '' }),
        el('button', { type: 'button', title: 'Xóa ảnh', text: '×', onclick: () => { urls.splice(i, 1); draw(); } }))));
      if (urls.length < (max || 30)) grid.appendChild(add);
    }
    add.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      if (!file.files.length) return;
      msg.textContent = 'Đang tải ' + file.files.length + ' ảnh…';
      try {
        const res = await Api.upload(file.files);
        res.forEach((f) => urls.push(f.url));
        msg.textContent = 'Đã tải xong. Ảnh sẽ được lưu vào hệ thống khi bấm Lưu.';
      } catch (e) { msg.textContent = ''; UI.toast(e.message, true); }
      file.value = ''; draw();
    });
    draw();
    return { node: el('div', {}, grid, file, msg, el('small', { class: 'muted', text: 'JPG, PNG, GIF, WEBP – tối đa 5 MB mỗi ảnh. Ảnh đầu tiên là ảnh đại diện.' })), get: () => urls.slice() };
  }

  // ---------- ô chọn có tìm kiếm ----------
  function refField(f, val) {
    const sel = el('select', {});
    const search = ADMIN_SRC[f.src].url.includes('/options/') ? el('input', { type: 'search', placeholder: 'Gõ để tìm…', class: 'ref-q' }) : null;
    let list = [];
    const fill = (items, keep) => {
      clear(sel).appendChild(el('option', { value: '', text: '— chọn —' }));
      items.forEach((o) => sel.appendChild(el('option', { value: o.v, text: o.t })));
      if (keep !== undefined && keep !== null && keep !== '') {
        if (!items.some((o) => String(o.v) === String(keep))) sel.appendChild(el('option', { value: keep, text: '#' + keep }));
        sel.value = String(keep);
      }
    };
    return loadSrc(f.src).then((items) => {
      list = items; fill(items, val);
      if (search) {
        let t;
        search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(async () => { const keep = sel.value; try { fill(await fetchSrc(f.src, search.value.trim()), keep); } catch (e) { /* bỏ qua */ } }, 250); });
      }
      return { node: el('div', {}, search, sel), input: sel };
    });
  }

  // ---------- form ----------
  async function buildForm(fields, values, opts) {
    opts = opts || {};
    const inputs = {}, custom = {};
    const grid = el('div', { class: 'form-grid' });
    for (const f of fields) {
      if (f.section) { grid.appendChild(el('h4', { class: 'form-sec full', text: f.section })); continue; }
      if (f.adminOnly && !isAdmin) continue;
      const val = values ? values[f.name] : undefined;
      let node, inp;
      if (f.type === 'ref') {
        const r = await refField(f, val); node = r.node; inp = r.input;
      } else if (f.type === 'select') {
        inp = el('select', {}, el('option', { value: '', text: '— chọn —' }), f.options.map((o) => el('option', { value: o.v, text: o.t })));
        if (val !== undefined && val !== null) inp.value = String(val);
        node = inp;
      } else if (f.type === 'bool') {
        inp = el('input', { type: 'checkbox' }); inp.checked = val === undefined ? true : !!val; node = inp;
      } else if (f.type === 'textarea') {
        inp = el('textarea', { rows: f.rows || 3 }); inp.value = val || ''; node = inp;
      } else if (f.type === 'images') {
        const up = uploader((values && (values[f.from || f.name]) || []).map((i) => (typeof i === 'string' ? i : i.url || i.imageUrl)), 30);
        custom[f.name] = up; node = up.node;
      } else if (f.type === 'location') {
        const host = el('div', { class: 'loc-inline' }); node = host;
        custom[f.name] = { picker: null, host, init: values };
      } else {
        const t = { number: 'number', date: 'date', month: 'month', password: 'password', datetime: 'datetime-local' }[f.type] || 'text';
        inp = el('input', { type: t, step: f.type === 'number' ? 'any' : null, autocomplete: t === 'password' ? 'new-password' : 'off' });
        if (val !== undefined && val !== null) inp.value = f.type === 'datetime' ? String(val).replace(' ', 'T').slice(0, 16) : val;
        node = inp;
      }
      if (inp) { if (opts.lock && opts.lock.includes(f.name)) inp.disabled = true; inputs[f.name] = { el: inp, f }; }
      grid.appendChild(f.type === 'bool'
        ? el('div', { class: 'field' + (f.full ? ' full' : '') }, el('label', { class: 'chk' }, inp, f.label))
        : el('div', { class: 'field' + (f.full ? ' full' : '') }, el('label', { text: f.label + (f.req ? ' *' : '') }), node));
    }
    function collect(forEdit) {
      const body = {}, missing = [];
      Object.values(inputs).forEach(({ el: i, f }) => {
        if (i.disabled) return;
        if (f.req && f.type !== 'bool' && i.value.trim() === '' && !(forEdit && f.type === 'password')) missing.push(f.label);
        if (f.type === 'bool') { body[f.name] = i.checked; return; }
        let v = i.value.trim();
        if (v === '') { if (forEdit && f.type !== 'password') body[f.name] = null; return; }
        if (f.type === 'number' || f.type === 'ref') v = Number(v);
        if (f.type === 'datetime') v = v.replace('T', ' ');
        body[f.name] = v;
      });
      Object.entries(custom).forEach(([name, c]) => {
        if (c.get) body[name] = c.get();
        else if (c.picker) {
          const v = c.picker.get();
          body.provinceId = v.provinceId ? Number(v.provinceId) : null;
          body.districtId = v.districtId ? Number(v.districtId) : null;
          body.wardId = v.wardId ? Number(v.wardId) : null;
          if (!v.provinceId) missing.push('Tỉnh / Thành phố (hãy bấm chọn trong danh sách)');
          else if (v.system === 'old' && !v.districtId) missing.push('Quận / Huyện (hệ Cũ)');
        }
      });
      // chủ nhà thêm tòa nhà: tự gán chính mình làm người quản lý
      if (!forEdit && !isAdmin && fields.some((f) => f.name === 'managerId')) body.managerId = me.id;
      if (missing.length) throw new Error('Còn thiếu: ' + missing.join('; ') + '.');
      return body;
    }
    return { node: grid, inputs, custom, collect, mountLocation: async () => {
      for (const c of Object.values(custom)) if (c.host) c.picker = await Loc.picker(c.host, { initial: c.init ? { provinceId: c.init.provinceId, districtId: c.init.districtId, wardId: c.init.wardId } : {} });
    } };
  }

  async function formModal(title, fields, values, onSave, o) {
    const f = await buildForm(fields, values, o);
    const msg = el('div');
    const save = el('button', { class: 'btn', type: 'submit', text: 'Lưu' });
    const form = el('form', {}, el('h3', { text: title }), msg, f.node, el('div', { class: 'form-actions' }, el('button', { class: 'btn light', type: 'button', text: 'Hủy', onclick: () => m.close() }), save));
    const m = UI.modal(form); m.root.firstChild.classList.add('big');
    await f.mountLocation();
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); clear(msg); save.disabled = true;
      try { await onSave(f.collect(!!(o && o.edit)), f); m.close(); } catch (err) { msg.appendChild(UI.alertBox('err', err.message)); save.disabled = false; msg.scrollIntoView({ block: 'nearest' }); }
    });
    return { m, form, f };
  }

  // ---------- bộ lọc theo tòa nhà ----------
  async function buildingSelect(initial) {
    const list = await loadSrc('buildings');
    const sel = el('select', {}, el('option', { value: '', text: 'Tất cả tòa nhà' }), list.map((o) => el('option', { value: o.v, text: o.t })));
    if (initial) sel.value = String(initial);
    return sel;
  }

  // ---------- bảng chung (nhóm Tòa nhà → Phòng) ----------
  function putRows(tbody, items, cols, grouped, rowFn) {
    let lastB = null, lastR = null;
    const span = cols.length + 1;
    items.forEach((row) => {
      if (grouped) {
        if (row.buildingName !== lastB) { tbody.appendChild(el('tr', { class: 'grp-b' }, el('td', { colspan: span, text: '🏢 ' + (row.buildingName || 'Chưa gán tòa nhà') }))); lastB = row.buildingName; lastR = null; }
        const rk = row.roomNumber || null;
        if (rk !== lastR) { tbody.appendChild(el('tr', { class: 'grp-r' }, el('td', { colspan: span, text: rk ? '🚪 Phòng ' + rk : 'Chưa gán phòng' }))); lastR = rk; }
      }
      tbody.appendChild(rowFn(row));
    });
  }

  const visibleCols = (res) => res.cols.filter((c) => !(c[3] === 'adminOnly' && !isAdmin));
  const IDS = (res) => res.id;

  async function listView(res, init) {
    const idKey = IDS(res);
    let page = 1, q = '', status = '', buildingId = (init && init.buildingId) || '';
    const extraQ = Object.assign({}, init);
    delete extraQ.buildingId;
    const readOnly = res.readOnly || (res.roRole && !isAdmin);
    const cols = visibleCols(res);
    const search = el('input', { type: 'search', placeholder: 'Tìm kiếm…' });
    const stSel = res.status ? el('select', {}, el('option', { value: '', text: 'Tất cả trạng thái' }), res.status.map((o) => el('option', { value: o.v, text: o.t }))) : null;
    const bSel = res.buildingFilter ? await buildingSelect(buildingId) : null;
    const tbody = el('tbody'), pagerBox = el('div', { class: 'pager' }), count = el('span', { class: 'muted' }), extra = el('span');
    const bar = el('div', { class: 'bar' }, bSel, search, stSel, count, el('span', { style: 'flex:1' }), extra,
      (res.noCreate || readOnly) ? null : el('button', { class: 'btn', type: 'button', text: '＋ Thêm mới', onclick: () => editRow(null) }));
    view.appendChild(bar);
    view.appendChild(el('div', { class: 'tbl-wrap' }, el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, cols.map((c) => el('th', { text: c[1] })), el('th', { text: '' }))), tbody)));
    view.appendChild(pagerBox);
    if (!isAdmin && res.grouped) view.appendChild(el('p', { class: 'muted', text: 'Chỉ hiển thị dữ liệu thuộc các tòa nhà do bạn làm chủ.' }));

    if (res.special === 'invoices') extra.appendChild(el('button', { class: 'btn orange', type: 'button', text: '⚙ Tạo hóa đơn tự động', onclick: genInvoice }));

    async function editRow(row) {
      const edit = !!row;
      let full = row;
      if (edit) { try { full = await Api.get('/api/admin/' + res.path + '/' + row[idKey]); } catch (e) { UI.toast(e.message, true); return; } }
      let fields = edit && res.path === 'users' ? res.fields.filter((f) => f.name !== 'username') : res.fields;
      const lockRoom = edit && res.path === 'contracts';
      await formModal((edit ? 'Sửa: ' : 'Thêm: ') + res.label.replace(/^\S+\s/, ''), fields, full, async (body) => {
        if (edit) await Api.put('/api/admin/' + res.path + '/' + row[idKey], body); else await Api.post('/api/admin/' + res.path, body);
        UI.toast('Đã lưu'); delete srcCache.rooms; delete srcCache.tenants; delete srcCache.buildings; delete srcCache.contracts; load();
      }, { edit, lock: lockRoom ? [] : [] });
    }
    async function del(row) {
      if (!confirmBox('Xóa bản ghi này?')) return;
      try { await Api.del('/api/admin/' + res.path + '/' + row[idKey]); UI.toast('Đã xóa'); load(); } catch (e) { UI.toast(e.message, true); }
    }
    function rowNode(row) {
      const tds = cols.map(([k, , fmt]) => {
        const raw = row[k];
        let text = fmt ? fmt(raw, row) : (k === res.statusKey ? statusText(res.status, raw) : (raw === null || raw === undefined ? '' : String(raw)));
        return el('td', { class: typeof raw === 'number' ? 'num' : '', text });
      });
      const acts = el('td', { class: 'acts' });
      if (res.special === 'invoices') acts.appendChild(el('button', { class: 'btn sm orange', type: 'button', text: 'Thanh toán', onclick: () => invoiceDialog(row.invoiceId, load) }));
      if (res.special === 'promotions') acts.appendChild(el('button', { class: 'btn sm orange', type: 'button', text: 'Phòng áp dụng', onclick: () => promoRooms(row.promotionId, load) }));
      if (res.special === 'contracts') {
        acts.appendChild(el('a', { class: 'btn sm orange', href: '/admin/contract.html?id=' + row.contractId, target: '_blank', rel: 'noopener', text: '📄 Xem / In PDF' }));
      }
      if (res.rowActions === 'owner') {
        acts.appendChild(el('a', { class: 'btn sm light', href: '#buildings?managerId=' + row.userId, text: 'Tòa nhà' }));
      }
      if (!readOnly) {
        acts.appendChild(el('button', { class: 'btn sm light', type: 'button', text: 'Sửa', onclick: () => editRow(row) }));
        acts.appendChild(el('button', { class: 'btn sm light', type: 'button', text: 'Xóa', onclick: () => del(row) }));
      }
      tds.push(acts);
      return el('tr', {}, tds);
    }
    async function load() {
      clear(tbody).appendChild(el('tr', {}, el('td', { colspan: cols.length + 1, class: 'muted', text: 'Đang tải…' })));
      try {
        const r = await Api.get('/api/admin/' + res.path, Object.assign({ q, status, buildingId, page, size: res.grouped ? 30 : 15 }, extraQ));
        clear(tbody);
        count.textContent = r.totalItems + ' bản ghi';
        if (!r.items.length) tbody.appendChild(el('tr', {}, el('td', { colspan: cols.length + 1, class: 'empty', text: 'Không có dữ liệu' })));
        putRows(tbody, r.items, cols, res.grouped, rowNode);
        UI.pager(pagerBox, r.page, r.totalPages, (p) => { page = p; load(); });
      } catch (e) { clear(tbody).appendChild(el('tr', {}, el('td', { colspan: cols.length + 1 }, UI.alertBox('err', e.message)))); }
    }
    let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { q = search.value.trim(); page = 1; load(); }, 300); });
    if (stSel) stSel.addEventListener('change', () => { status = stSel.value; page = 1; load(); });
    if (bSel) bSel.addEventListener('change', () => { buildingId = bSel.value; page = 1; load(); });
    load();
  }

  // ---------- hóa đơn ----------
  function genInvoice() {
    formModal('Tạo hóa đơn tự động', [
      { name: 'contractId', label: 'Hợp đồng', type: 'ref', src: 'contracts', req: 1, full: 1 },
      { name: 'billingMonth', label: 'Tháng', type: 'month', req: 1 },
      { name: 'dueDate', label: 'Hạn thanh toán (trống = ngày 5 tháng sau)', type: 'date' }], {}, async (body) => {
      const r = await Api.post('/api/admin/invoices/generate', body);
      UI.toast('Đã tạo hóa đơn' + (r.warnings && r.warnings.length ? ' – ' + r.warnings.join('; ') : ''));
      route();
    });
  }
  async function invoiceDialog(id, done) {
    const inv = await Api.get('/api/admin/invoices/' + id);
    const box = el('div', {},
      el('h3', { text: 'Hóa đơn ' + inv.invoiceCode + ' – ' + inv.buildingName + ' / ' + inv.roomNumber }),
      el('div', { class: 'muted', text: inv.tenantName + ' • tháng ' + inv.billingMonth + ' • hạn ' + inv.dueDate }),
      el('table', { class: 'tbl' }, el('tbody', {}, inv.details.map((d) => el('tr', {}, el('td', { text: d.description || d.serviceName }), el('td', { class: 'num', text: UI.vnd(d.subtotal) }))))),
      el('p', {}, 'Tổng: ', el('b', { text: UI.vnd(inv.totalAmount) }), ' • Còn nợ: ', el('b', { text: UI.vnd(inv.remaining) }), ' • ', statusText(ADMIN_STATUS.invoice, inv.status)),
      inv.payments.length ? el('div', {}, el('b', { text: 'Đã thanh toán' }), el('ul', {}, inv.payments.map((p) => el('li', { text: p.paidAt + ' – ' + UI.vnd(p.amountPaid) + ' (' + p.method + ')' })))) : null);
    const amount = el('input', { type: 'number', placeholder: 'Số tiền', value: inv.remaining > 0 ? inv.remaining : '' });
    const method = el('select', {}, [['cash', 'Tiền mặt'], ['bank_transfer', 'Chuyển khoản'], ['momo', 'MoMo'], ['other', 'Khác']].map(([v, t]) => el('option', { value: v, text: t })));
    const msg = el('div');
    const m = UI.modal(box); m.root.firstChild.classList.add('big');
    if (inv.status !== 'paid' && inv.status !== 'cancelled') {
      box.appendChild(el('div', { class: 'bar' }, amount, method, el('button', { class: 'btn', type: 'button', text: 'Ghi nhận thanh toán', onclick: async () => {
        clear(msg); try { await Api.post('/api/admin/payments', { invoiceId: id, amountPaid: Number(amount.value), method: method.value }); UI.toast('Đã ghi nhận'); m.close(); done(); } catch (e) { msg.appendChild(UI.alertBox('err', e.message)); } } })));
      if (!inv.payments.length) box.appendChild(el('button', { class: 'btn sm light', type: 'button', text: 'Hủy hóa đơn', onclick: async () => { if (!confirmBox('Hủy hóa đơn này?')) return; try { await Api.post('/api/admin/invoices/' + id + '/cancel'); m.close(); done(); } catch (e) { msg.appendChild(UI.alertBox('err', e.message)); } } }));
    }
    box.appendChild(msg);
  }

  // ---------- khuyến mãi: chọn phòng áp dụng ----------
  async function promoRooms(id, done) {
    const [p, rooms] = await Promise.all([Api.get('/api/admin/promotions/' + id), fetchSrc('rooms')]);
    const pct = p.discountPercent;
    const cur = Object.fromEntries((p.rooms || []).map((r) => [r.roomId, r.dealPrice]));
    const rows = rooms.map((r) => {
      const cb = el('input', { type: 'checkbox' }); cb.checked = r.v in cur;
      const price = el('input', { type: 'number', placeholder: pct ? 'Tự tính theo ' + pct + '%' : 'Giá ưu đãi', value: pct ? '' : (cur[r.v] || ''), disabled: pct ? true : null });
      return { r, cb, price, node: el('tr', {}, el('td', {}, cb), el('td', { text: r.t }), el('td', { class: 'num', text: UI.vnd(r.raw.basePrice || r.raw.baseRentPrice) }), el('td', {}, price)) };
    });
    const msg = el('div');
    const m = UI.modal(el('div', {}, el('h3', { text: 'Phòng áp dụng: ' + p.title }),
      el('p', { class: 'muted', text: pct ? 'Chương trình giảm ' + pct + '%: giá ưu đãi của từng phòng được tự tính (làm tròn nghìn đồng).' : 'Chọn phòng và nhập giá ưu đãi cho từng phòng. (Hoặc điền "% giảm giá" ở chương trình để tự tính.)' }), msg,
      el('div', { style: 'max-height:50vh;overflow:auto' }, el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, el('th'), el('th', { text: 'Tòa nhà - Phòng' }), el('th', { class: 'num', text: 'Giá gốc' }), el('th', { text: 'Giá ưu đãi' }))), el('tbody', {}, rows.map((x) => x.node)))),
      el('div', { style: 'text-align:right;margin-top:10px' }, el('button', { class: 'btn', type: 'button', text: 'Lưu', onclick: async () => {
        clear(msg);
        const list = rows.filter((x) => x.cb.checked).map((x) => ({ roomId: x.r.v, dealPrice: x.price.value ? Number(x.price.value) : undefined }));
        try { await Api.put('/api/admin/promotions/' + id + '/rooms', { rooms: list }); UI.toast('Đã lưu'); m.close(); done(); } catch (e) { msg.appendChild(UI.alertBox('err', e.message)); }
      } }))));
    m.root.firstChild.classList.add('big');
  }

  // ---------- phòng ----------
  const ROOM_FIELDS = [
    { name: 'buildingId', label: 'Tòa nhà', type: 'ref', src: 'buildings', req: 1 }, { name: 'typeId', label: 'Loại hình', type: 'ref', src: 'roomTypes', req: 1 },
    { name: 'roomNumber', label: 'Mã phòng', req: 1 }, { name: 'title', label: 'Tiêu đề', req: 1 }, { name: 'baseRentPrice', label: 'Giá thuê/tháng', type: 'number', req: 1 }, { name: 'areaM2', label: 'Diện tích (m²)', type: 'number' },
    { name: 'maxOccupants', label: 'Sức chứa tối đa', type: 'number' }, { name: 'currentOccupants', label: 'Số người đang ở', type: 'number' },
    { name: 'status', label: 'Trạng thái', type: 'select', options: [{ v: 'available', t: 'Còn trống' }, { v: 'occupied', t: 'Đã thuê' }, { v: 'maintenance', t: 'Sửa chữa' }, { v: 'hidden', t: 'Ẩn' }] },
    { name: 'isNew', label: 'Mới đăng', type: 'bool' }, { name: 'isHot', label: 'HOT', type: 'bool' }, { name: 'isNow', label: 'NOW – dọn vào ở ngay', type: 'bool' },
    { name: 'imageUrls', type: 'images', label: 'Ảnh phòng', full: 1, from: 'images' },
    { name: 'description', label: 'Mô tả', type: 'textarea', full: 1 },
  ];
  const OCC = { empty: 'Ế (0 người)', almost_empty: 'Sắp trống', full: 'Đã kín' };
  async function roomsView(init) {
    let page = 1, q = '', status = '', occupancy = '', buildingId = (init && init.buildingId) || '';
    const bSel = await buildingSelect(buildingId);
    const search = el('input', { type: 'search', placeholder: 'Tìm mã phòng, tiêu đề…' });
    const stSel = el('select', {}, el('option', { value: '', text: 'Phòng đang hoạt động' }), [['available', 'Còn trống'], ['occupied', 'Đã thuê'], ['maintenance', 'Sửa chữa'], ['hidden', 'Đã ẩn (khôi phục được)']].map(([v, t]) => el('option', { value: v, text: t })));
    const occSel = el('select', {}, el('option', { value: '', text: 'Mọi mức lấp đầy' }), Object.entries(OCC).map(([v, t]) => el('option', { value: v, text: t })));
    const tbody = el('tbody'), pagerBox = el('div', { class: 'pager' }), count = el('span', { class: 'muted' });
    view.appendChild(el('div', { class: 'bar' }, bSel, search, stSel, occSel, count, el('span', { style: 'flex:1' }), el('button', { class: 'btn', type: 'button', text: '＋ Thêm phòng', onclick: () => editRoom(null) })));
    const heads = ['', 'Mã', 'Tiêu đề', 'Loại', 'Giá', 'Người ở', 'Lượt xem', 'Trạng thái', ''];
    view.appendChild(el('div', { class: 'tbl-wrap' }, el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, heads.map((h) => el('th', { text: h })))), tbody)));
    view.appendChild(pagerBox);

    async function editRoom(row) {
      const edit = !!row;
      let full = {}, amenities = [];
      try { amenities = (await Api.get('/api/meta')).amenities; if (edit) full = await Api.get('/api/rooms/' + row.roomId); } catch (e) { UI.toast(e.message, true); return; }
      const sel = new Set((full.amenities || []).map((a) => a.amenityId));
      const checks = el('div', { class: 'checks' }, amenities.map((a) => { const c = el('input', { type: 'checkbox', value: a.amenityId }); c.checked = sel.has(a.amenityId); return el('label', {}, c, a.name); }));
      const { form } = await formModal(edit ? 'Sửa phòng ' + row.roomNumber : 'Thêm phòng', ROOM_FIELDS, full, async (body) => {
        body.amenityIds = [...checks.querySelectorAll('input:checked')].map((c) => Number(c.value));
        if (edit) { delete body.roomNumber; await Api.put('/api/rooms/' + row.roomId, body); } else await Api.post('/api/rooms', body);
        delete srcCache.rooms; UI.toast('Đã lưu phòng'); load();
      }, { edit, lock: edit ? ['roomNumber'] : [] });
      form.insertBefore(el('div', { class: 'field' }, el('label', { text: 'Tiện nghi' }), checks), form.lastChild);
    }
    async function remove(row, perm) {
      if (!confirmBox(perm ? 'XÓA VĨNH VIỄN phòng ' + row.roomNumber + '? Không thể hoàn tác.' : 'Ẩn phòng ' + row.roomNumber + '? (có thể khôi phục)')) return;
      try { const r = await Api.del('/api/rooms/' + row.roomId + '?type=' + (perm ? 1 : 2)); UI.toast(r.message); load(); } catch (e) { UI.toast(e.message, true); }
    }
    async function restore(row) { try { await Api.post('/api/rooms/' + row.roomId + '/restore'); UI.toast('Đã khôi phục phòng'); load(); } catch (e) { UI.toast(e.message, true); } }
    async function pin(row) {
      try { await Api.post('/api/admin/rooms/' + row.roomId + '/feature', { isFeatured: !row.isFeatured, featuredOrder: 0 }); UI.toast(row.isFeatured ? 'Đã bỏ khỏi mục nổi bật' : 'Đã đưa lên mục nổi bật'); load(); } catch (e) { UI.toast(e.message, true); }
    }
    async function load() {
      clear(tbody);
      try {
        const r = await Api.get('/api/rooms', { admin: 1, q, status, occupancy, buildingId, page, size: 30, sort: 'building' });
        count.textContent = r.totalItems + ' phòng';
        if (!r.items.length) tbody.appendChild(el('tr', {}, el('td', { colspan: heads.length, class: 'empty', text: 'Không có phòng' })));
        let last = null;
        r.items.forEach((x) => {
          if (x.buildingName !== last) { tbody.appendChild(el('tr', { class: 'grp-b' }, el('td', { colspan: heads.length, text: '🏢 ' + x.buildingName }))); last = x.buildingName; }
          const acts = el('td', { class: 'acts' });
          if (isAdmin || x.managerId === me.id) {
            acts.appendChild(el('button', { class: 'btn sm light', type: 'button', text: 'Sửa', onclick: () => editRoom(x) }));
            if (x.status === 'hidden') acts.appendChild(el('button', { class: 'btn sm orange', type: 'button', text: 'Khôi phục', onclick: () => restore(x) }));
            else acts.appendChild(el('button', { class: 'btn sm light', type: 'button', text: 'Ẩn', onclick: () => remove(x, false) }));
            if (isAdmin) { acts.appendChild(el('button', { class: 'btn sm light', type: 'button', text: x.isFeatured ? '★ Bỏ nổi bật' : '☆ Nổi bật', onclick: () => pin(x) })); acts.appendChild(el('button', { class: 'btn sm light', type: 'button', text: 'Xóa hẳn', onclick: () => remove(x, true) })); }
          } else acts.appendChild(el('span', { class: 'muted', text: 'Chỉ xem' }));
          tbody.appendChild(el('tr', {}, el('td', {}, el('img', { class: 'mini', src: UI.safeUrl(x.thumbnailUrl), alt: '' })), el('td', { text: x.roomNumber }), el('td', { text: x.title + (x.isFeatured ? ' ★' : '') }), el('td', { text: x.typeName }), el('td', { class: 'num', text: UI.vnd(x.baseRentPrice) }),
            el('td', { text: x.currentOccupants + '/' + x.maxOccupants + (OCC[x.occupancyState] ? ' • ' + OCC[x.occupancyState] : '') }), el('td', { class: 'num', text: x.viewCount }), el('td', { text: x.status }), acts));
        });
        UI.pager(pagerBox, r.page, r.totalPages, (p) => { page = p; load(); });
      } catch (e) { tbody.appendChild(el('tr', {}, el('td', { colspan: heads.length }, UI.alertBox('err', e.message)))); }
    }
    let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { q = search.value.trim(); page = 1; load(); }, 300); });
    stSel.addEventListener('change', () => { status = stSel.value; page = 1; load(); });
    occSel.addEventListener('change', () => { occupancy = occSel.value; page = 1; load(); });
    bSel.addEventListener('change', () => { buildingId = bSel.value; page = 1; load(); });
    load();
  }

  // ---------- tổng quan ----------
  async function dashboardView() {
    const d = await Api.get('/api/admin/dashboard');
    const kpi = (label, val, href) => el(href ? 'a' : 'div', { class: 'kpi', href }, el('small', { text: label }), el('b', { text: val }));
    const k = [kpi('Tòa nhà', d.buildings, '#buildings'), kpi('Tổng số phòng', d.rooms.total, '#rooms'), kpi('Phòng còn trống', d.rooms.available), kpi('Phòng ế (0 người)', d.rooms.empty), kpi('Phòng đã kín', d.rooms.full),
      kpi('Người thuê', d.tenants, '#tenants'), kpi('Hợp đồng hiệu lực', d.activeContracts, '#contracts'), kpi('Sự cố đang mở', d.openTickets, '#tickets'),
      kpi('Hóa đơn chưa thu', d.unpaidInvoices + ' • ' + UI.vnd(d.unpaidAmount), '#invoices'), kpi('Doanh thu tháng này', UI.vnd(d.revenueThisMonth)), kpi('Lịch xem phòng mới', d.newRequests.viewing, '#viewing-requests')];
    if (isAdmin) k.push(kpi('Chủ tòa nhà', d.owners, '#owners'), kpi('Tài khoản', d.users, '#users'), kpi('Khuyến mãi đang chạy', d.runningPromotions, '#promotions'), kpi('Phòng ghim nổi bật', d.featuredRooms, '#featured'),
      kpi('Yêu cầu hỗ trợ mới', d.newRequests.support, '#support-requests'), kpi('Đơn môi giới mới', d.newRequests.brokers, '#broker-applications'));
    view.appendChild(el('div', { class: 'cards' }, k));
    const tbl = (head, rows) => el('div', { class: 'tbl-wrap' }, el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, head.map((h) => el('th', { text: h })))), el('tbody', {}, rows.length ? rows : el('tr', {}, el('td', { colspan: head.length, class: 'muted', text: 'Không có' })))));
    view.appendChild(el('h3', { text: isAdmin ? 'Theo từng tòa nhà' : 'Các tòa nhà của bạn' }));
    view.appendChild(tbl(['Tòa nhà', isAdmin ? 'Chủ tòa' : '', 'Số phòng', 'Có người ở', 'HĐ hiệu lực', 'Sự cố mở'], d.byBuilding.map((b) => el('tr', {}, el('td', {}, el('a', { href: '#rooms?buildingId=' + b.buildingId, text: b.name })), el('td', { text: isAdmin ? b.managerName : '' }), el('td', { class: 'num', text: b.roomCount }), el('td', { class: 'num', text: b.occupiedRooms }), el('td', { class: 'num', text: b.activeContracts }), el('td', { class: 'num', text: b.openTickets })))));
    view.appendChild(el('div', { class: 'two', style: 'margin-top:16px' },
      tbl(['Hợp đồng sắp hết hạn', 'Hết hạn'], d.expiringContracts.map((c) => el('tr', {}, el('td', { text: c.buildingName + ' / ' + c.roomNumber + ' – ' + c.tenantName }), el('td', { text: c.endDate })))),
      tbl(['Phòng được xem nhiều', 'Lượt xem'], d.topViewedRooms.map((r) => el('tr', {}, el('td', { text: r.buildingName + ' / ' + r.roomNumber + ' – ' + r.title }), el('td', { class: 'num', text: r.viewCount }))))));
    view.appendChild(el('div', { style: 'margin-top:16px' }, tbl(['Tháng', 'Doanh thu'], d.revenueByMonth.map((x) => el('tr', {}, el('td', { text: x.month }), el('td', { class: 'num', text: UI.vnd(x.amount) }))))));
  }

  // ---------- cấu hình: hotline, zalo, ... ----------
  async function settingsView() {
    const s = await Api.get('/api/admin/settings');
    const defs = [['site_name', 'Tên website', ''], ['tagline', 'Khẩu hiệu', ''], ['hotline', '☎ Số hotline', 'Hiện ở chân trang và mục hỗ trợ khách hàng. Ví dụ: 1900 6868'], ['zalo', '💬 Số Zalo', 'Số điện thoại Zalo, khách bấm sẽ mở zalo.me. Ví dụ: 0901234567'],
      ['email', '✉ Email', ''], ['facebook', 'Liên kết Facebook (https://…)', ''], ['address', 'Địa chỉ văn phòng', '']];
    const inputs = {}, msg = el('div');
    const form = el('form', { class: 'card set-form' }, msg,
      defs.map(([k, label, hint]) => { inputs[k] = el('input', { value: s[k] || '', class: k === 'hotline' || k === 'zalo' ? 'hl' : '' }); return el('div', { class: 'field' }, el('label', { text: label }), inputs[k], hint ? el('small', { class: 'muted', text: hint }) : null); }),
      el('button', { class: 'btn', type: 'submit', text: 'Lưu cấu hình' }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); clear(msg);
      try { await Api.put('/api/admin/settings', Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value]))); msg.appendChild(UI.alertBox('ok', 'Đã lưu. Trang chủ và chân trang sẽ cập nhật ngay.')); } catch (err) { msg.appendChild(UI.alertBox('err', err.message)); }
    });
    view.appendChild(form);
  }

  // ---------- mục nổi bật ----------
  async function featuredView() {
    const d = await Api.get('/api/admin/featured');
    const st = d.settings || {};
    const mode = el('select', {}, [['mixed', 'Kết hợp: phòng ghim trước, còn lại lấy theo lượt xem'], ['manual', 'Thủ công: chỉ phòng do Admin ghim'], ['auto', 'Tự động: theo số lượt xem']].map(([v, t]) => el('option', { value: v, text: t })));
    mode.value = st.featured_mode || 'mixed';
    const count = el('input', { type: 'number', min: 1, max: 12, value: st.featured_count || 4 });
    const TYPES = [['ky-tuc-xa', 'Ký túc xá nổi bật'], ['nha', 'Nhà nổi bật'], ['chung-cu', 'Chung cư nổi bật'], ['phong-tro', 'Phòng trọ nổi bật'], ['van-phong', 'Văn phòng nổi bật'], ['pass-phong', 'Pass phòng & ở ghép nổi bật']];
    const on = new Set((st.featured_types || 'ky-tuc-xa,nha,chung-cu,phong-tro').split(',').map((x) => x.trim()).filter(Boolean));
    const checks = el('div', { class: 'checks' }, TYPES.map(([slug, label]) => { const c = el('input', { type: 'checkbox', value: slug }); c.checked = on.has(slug); return el('label', {}, c, label); }));
    const msg = el('div');
    const form = el('form', { class: 'card set-form' }, el('h3', { text: 'Cách chọn phòng nổi bật trên trang chủ' }), msg,
      el('div', { class: 'field' }, el('label', { text: 'Chế độ' }), mode), el('div', { class: 'field' }, el('label', { text: 'Số phòng mỗi mục (1–12)' }), count),
      el('div', { class: 'field' }, el('label', { text: 'Các mục hiển thị' }), checks), el('button', { class: 'btn', type: 'submit', text: 'Lưu cấu hình nổi bật' }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); clear(msg);
      try { await Api.put('/api/admin/settings', { featured_mode: mode.value, featured_count: String(count.value), featured_types: [...checks.querySelectorAll('input:checked')].map((c) => c.value).join(',') }); msg.appendChild(UI.alertBox('ok', 'Đã lưu')); route(); } catch (err) { msg.appendChild(UI.alertBox('err', err.message)); }
    });
    view.appendChild(form);

    // phòng đã ghim
    const pinned = el('tbody');
    const drawPinned = (rows) => { clear(pinned); if (!rows.length) pinned.appendChild(el('tr', {}, el('td', { colspan: 5, class: 'muted', text: 'Chưa ghim phòng nào' })));
      rows.forEach((r) => {
        const ord = el('input', { type: 'number', value: r.featuredOrder || 0, style: 'width:70px' });
        pinned.appendChild(el('tr', {}, el('td', { text: r.buildingName + ' / ' + r.roomNumber + ' – ' + r.title }), el('td', { text: r.typeName }), el('td', { class: 'num', text: r.viewCount }), el('td', {}, ord),
          el('td', { class: 'acts' }, el('button', { class: 'btn sm light', type: 'button', text: 'Lưu thứ tự', onclick: async () => { try { await Api.post('/api/admin/rooms/' + r.roomId + '/feature', { isFeatured: true, featuredOrder: Number(ord.value) || 0 }); UI.toast('Đã lưu'); } catch (e) { UI.toast(e.message, true); } } }),
            el('button', { class: 'btn sm light', type: 'button', text: 'Bỏ ghim', onclick: async () => { try { await Api.post('/api/admin/rooms/' + r.roomId + '/feature', { isFeatured: false }); route(); } catch (e) { UI.toast(e.message, true); } } }))));
      }); };
    drawPinned(d.pinned);
    view.appendChild(el('h3', { style: 'margin-top:20px', text: 'Phòng đã ghim (xuất hiện đầu tiên trong mục theo loại hình)' }));
    view.appendChild(el('div', { class: 'tbl-wrap' }, el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, ['Phòng', 'Loại hình', 'Lượt xem', 'Thứ tự (nhỏ lên trước)', ''].map((h) => el('th', { text: h })))), pinned)));

    // ghim thêm
    const q = el('input', { type: 'search', placeholder: 'Tìm phòng để ghim (mã, tên tòa…)' }), res = el('div', { class: 'tbl-wrap', style: 'margin-top:10px' });
    let t;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(async () => {
      const r = await Api.get('/api/rooms', { admin: 1, q: q.value.trim(), size: 8, sort: 'popular' }).catch(() => ({ items: [] }));
      clear(res).appendChild(el('table', { class: 'tbl' }, el('tbody', {}, r.items.map((x) => el('tr', {}, el('td', { text: x.buildingName + ' / ' + x.roomNumber + ' – ' + x.title }), el('td', { text: x.typeName }), el('td', { class: 'num', text: x.viewCount + ' lượt xem' }),
        el('td', {}, x.isFeatured ? el('span', { class: 'muted', text: 'Đã ghim' }) : el('button', { class: 'btn sm', type: 'button', text: '☆ Ghim', onclick: async () => { try { await Api.post('/api/admin/rooms/' + x.roomId + '/feature', { isFeatured: true, featuredOrder: 0 }); route(); } catch (e) { UI.toast(e.message, true); } } })))))));
    }, 300); });
    view.appendChild(el('h3', { style: 'margin-top:20px', text: 'Ghim thêm phòng' }));
    view.appendChild(el('div', { class: 'bar' }, q)); view.appendChild(res);

    // xem trước
    view.appendChild(el('h3', { style: 'margin-top:20px', text: 'Đang hiển thị trên trang chủ' }));
    (d.sections || []).forEach((s) => view.appendChild(el('p', {}, el('b', { text: s.title + ': ' }), s.rooms.map((r) => r.roomNumber + (r.featuredSource === 'pinned' ? ' ★' : ' (' + r.viewCount + ' lượt xem)')).join(', '))));
  }

  // ---------- router ----------
  function parseHash() {
    const h = location.hash.slice(1) || 'dashboard';
    const [key, qs] = h.split('?');
    return { key, params: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  function drawSide(active) {
    clear(side);
    side.appendChild(el('div', { class: 'who-box' }, el('b', { text: me.fullName }), el('small', { text: isAdmin ? 'Quản trị viên – xem toàn hệ thống' : 'Chủ tòa nhà – chỉ dữ liệu của bạn' })));
    let lastGroup = null;
    ADMIN_RES.filter((r) => isAdmin || !r.adminOnly).forEach((r) => {
      if (r.group && r.group !== lastGroup) { side.appendChild(el('h4', { text: r.group })); lastGroup = r.group; }
      side.appendChild(el('a', { href: '#' + r.key, class: r.key === active ? 'on' : '', text: r.label }));
    });
    if (!isAdmin) side.appendChild(el('a', { href: '/profile.html#manager', class: 'quit', text: '⚠ Hủy quyền quản lý' }));
  }
  async function route() {
    const { key, params } = parseHash();
    const res = ADMIN_RES.find((r) => r.key === key && (isAdmin || !r.adminOnly)) || ADMIN_RES[0];
    document.querySelectorAll('.modal-bg').forEach((n) => n.remove());
    drawSide(res.key);
    clear(view).appendChild(el('h1', { text: res.label }));
    try {
      if (res.special === 'dashboard') await dashboardView();
      else if (res.special === 'rooms') await roomsView(params);
      else if (res.special === 'settings') await settingsView();
      else if (res.special === 'featured') await featuredView();
      else await listView(res, params);
    } catch (e) { view.appendChild(UI.alertBox('err', e.message)); }
  }
  window.addEventListener('hashchange', route);
  route();
})();
