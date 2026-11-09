import { getEmployee, addWeighing, subscribeWeighings } from "./api.js";

const CFG = {
  minWeight: 0.05,     // kg: dưới mức này coi như chưa có hàng
  zeroBelow: 0.02,     // kg: cân về dưới mức này mới nhận hàng kế tiếp
  expireSec: 30,       // chỉ có 1 trong 2 thông tin quá lâu thì tự hủy
};

const SET_KEY = 'tramcan.settings';
const DEF = {
  scale: { baud: 9600, dataBits: 8, parity: 'none', stopBits: 1 },
  scan: { baud: 9600, dataBits: 8, parity: 'none', stopBits: 1 },
  ids: {},   // vendor/product id của cổng đã cấp quyền, để tự nối lại
};
const loadSettings = () => {
  try { const s = JSON.parse(localStorage.getItem(SET_KEY) || '{}');
    return { scale: { ...DEF.scale, ...s.scale }, scan: { ...DEF.scan, ...s.scan }, ids: { ...s.ids } }; }
  catch (e) { return structuredClone(DEF); }
};

// Đối tượng phần cứng để ngoài Alpine (proxy reactive làm hỏng đối tượng gốc của trình duyệt)
const hw = { ports: {}, readers: {}, flush: {} };

window.app = () => ({
  st: 'idle', msg: 'Sẵn sàng: đưa thẻ lên quét hoặc đặt hàng lên cân',
  emp: null, pw: null, live: 0, stable: false, test: 0,
  cam: false, serial: false, scanCom: false, online: true, rows: [], raw: '',
  qr: null, camIdx: 0, cams: [], lastCode: '', lastAt: 0,
  needZero: false, timer: null, saving: false, same: 0, prev: null,
  set: loadSettings(), bauds: [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200],

  init() {
    this.$watch('set', v => localStorage.setItem(SET_KEY, JSON.stringify(v)));
    this.toggleCam();                                  // tự bật camera khi mở trang
    this.autoConnect();
    if ('serial' in navigator) navigator.serial.addEventListener('connect', () => this.autoConnect());
    subscribeWeighings(10, rows => { this.online = true; this.rows = rows; }, () => { this.online = false; });
    // Súng quét: ký tự đến rất nhanh rồi Enter
    let buf = '', t0 = 0;
    addEventListener('keydown', e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const now = Date.now();
      if (now - t0 > 100) buf = '';
      t0 = now;
      if (e.key === 'Enter') { if (buf.length >= 3) this.onEmployee(buf, 'gun'); buf = ''; }
      else if (e.key.length === 1) buf += e.key;
    });
  },

  /* ---------- Camera ---------- */
  async toggleCam() {
    if (this.cam) { await this.qr.stop().catch(() => {}); this.cam = false; return; }
    try {
      this.qr = this.qr || new Html5Qrcode('reader');
      this.cams = this.cams.length ? this.cams : await Html5Qrcode.getCameras();
      const src = this.cams.length ? this.cams[this.camIdx % this.cams.length].id : { facingMode: 'environment' };
      await this.qr.start(src, {
          fps: 15,
          qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.8); return { width: s, height: s }; },
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        },
        code => this.onEmployee(code, 'camera'), () => {});
      this.cam = true;
    } catch (e) { this.flash('err', 'Không mở được camera (cần HTTPS và cấp quyền)'); }
  },
  async switchCam() { this.camIdx++; if (this.cam) { await this.toggleCam(); } await this.toggleCam(); },

  /* ---------- Nhận nhân viên ---------- */
  async onEmployee(raw, source) {
    const code = String(raw).trim();
    const now = Date.now();
    if (code === this.lastCode && now - this.lastAt < 3000) return;   // chống quét trùng
    this.lastCode = code; this.lastAt = now;
    if (this.saving) return;
    let name = code;
    try { const e = await getEmployee(code); if (e && e.name) name = e.name; }
    catch (e) { /* offline: dùng mã làm tên */ }
    this.emp = { code, name, source };
    this.beep(900);
    this.afterChange();
  },

  /* ---------- Nhận cân ---------- */
  feed(w, stable) {
    if (typeof w !== 'number' || isNaN(w)) return;
    if (this.needZero) {                               // vừa lưu: giữ ô cân ở 0 cho tới khi nhấc hàng xuống
      this.live = 0; this.stable = false;
      if (w < CFG.zeroBelow) this.needZero = false;
      return;
    }
    this.live = w; this.stable = stable;
    if (this.pw === null && stable && w >= CFG.minWeight) {
      this.pw = w; this.beep(600); this.afterChange();
    }
  },

  /* ---------- Nối cân / súng quét COM ---------- */
  async pickPort(role) {
    if (!('serial' in navigator)) return this.flash('err', 'Trình duyệt không hỗ trợ Web Serial (dùng Chrome/Edge, HTTPS)');
    try { await this.openPort(role, await navigator.serial.requestPort()); }
    catch (e) { if (e.name !== 'NotFoundError') this.flash('err', `Lỗi nối ${role === 'scale' ? 'cân' : 'súng quét'}: ${e.message}`); }
  },

  async openPort(role, port) {
    const c = this.set[role];
    await port.open({ baudRate: +c.baud, dataBits: +c.dataBits, parity: c.parity, stopBits: +c.stopBits });
    const i = port.getInfo();
    this.set.ids[role] = { v: i.usbVendorId, p: i.usbProductId };
    hw.ports[role] = port; this.setConn(role, true);
    this.readLoop(role, port);
  },

  async readLoop(role, port) {
    const dec = new TextDecoderStream();
    const piped = port.readable.pipeTo(dec.writable).catch(() => {});
    const reader = dec.readable.getReader();
    hw.readers[role] = reader;
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split(/[\r\n]+/); buf = lines.pop();
        lines.forEach(l => this.onLine(role, l.trim()));
        clearTimeout(hw.flush[role]);
        if (role === 'scan' && buf) hw.flush[role] = setTimeout(() => { this.onLine(role, buf.trim()); buf = ''; }, 80);  // súng không gửi Enter
      }
    } catch (e) { /* rút cáp */ }
    await piped;
    await port.close().catch(() => {});
    hw.ports[role] = null; hw.readers[role] = null; this.setConn(role, false);
  },

  onLine(role, line) {
    if (!line) return;
    if (role === 'scale') { this.raw = line; this.parse(line); }
    else if (line.length >= 3) this.onEmployee(line, 'scanner-com');
  },

  setConn(role, on) { if (role === 'scale') this.serial = on; else this.scanCom = on; },

  async disconnect(role) { await hw.readers[role]?.cancel().catch(() => {}); },

  async autoConnect() {                                // tự nối lại cổng đã cấp quyền trước đó
    if ('serial' in navigator) {
      const ports = await navigator.serial.getPorts();
      for (const role of ['scale', 'scan']) {
        const id = this.set.ids[role];
        if (!id || hw.ports[role]) continue;
        const p = ports.find(x => { const i = x.getInfo();
          return i.usbVendorId === id.v && i.usbProductId === id.p && !Object.values(hw.ports).includes(x); });
        if (p) { try { await this.openPort(role, p); } catch (e) {} }
      }
    }
  },
  parse(line) {                                        // vd "ST,GS,  12.450kg"
    const m = line.match(/(-?\d+(?:\.\d+)?)\s*(kg|g)?/i);
    if (!m) return;
    let w = parseFloat(m[1]); if ((m[2] || '').toLowerCase() === 'g') w /= 1000;
    let stable;
    if (/\bST\b/.test(line)) stable = true;
    else if (/\bUS\b/.test(line)) stable = false;
    else { this.same = (w === this.prev) ? this.same + 1 : 0; this.prev = w; stable = this.same >= 4; }
    this.feed(w, stable);
  },

  /* ---------- Có đủ 2 thông tin chưa? ---------- */
  afterChange() {
    clearTimeout(this.timer);
    if (this.emp && this.pw !== null) return this.save();
    this.timer = setTimeout(() => this.cancel('Quá thời gian, đã hủy. Làm lại từ đầu'), CFG.expireSec * 1000);
    if (this.pw !== null) this.flash('wait', `⚠ Đã có cân ${this.pw.toFixed(3)} kg — PHẢI QUÉT NHÂN VIÊN`, true);
    else this.flash('wait', `Đã nhận ${this.emp.name} — hãy đặt hàng lên cân`, true);
  },

  async save() {
    this.saving = true;
    const rec = { empCode: this.emp.code, empName: this.emp.name, weight: this.pw, unit: 'kg',
      source: this.emp.source };
    try {
      await addWeighing(rec);
      this.beep(1200);
      this.flash('ok', `✔ Đã lưu: ${rec.empName} — ${rec.weight.toFixed(3)} kg`);
      this.needZero = true;                            // phải nhấc hàng xuống mới nhận lần sau
      this.live = 0; this.stable = false; this.raw = ''; this.same = 0; this.prev = null;   // xóa số cân hiện tại
    } catch (e) { this.flash('err', 'Lưu thất bại, kiểm tra mạng/quyền Firestore'); }
    this.emp = null; this.pw = null; this.saving = false;
    setTimeout(() => { if (this.st === 'ok') this.flash('idle', 'Sẵn sàng: đưa thẻ lên quét hoặc đặt hàng lên cân'); }, 3000);
  },

  cancel(text) {
    clearTimeout(this.timer); this.emp = null; this.pw = null;
    this.flash('idle', text || 'Đã hủy. Sẵn sàng nhận lại');
  },

  flash(st, msg) { this.st = st; this.msg = msg; if (st === 'err') this.beep(300); },
  beep(f) {
    try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator();
      o.frequency.value = f; o.connect(c.destination); o.start(); setTimeout(() => { o.stop(); c.close(); }, 150); } catch (e) {}
  },
});

// Nạp Alpine sau khi app() đã sẵn sàng
const s = document.createElement('script');
s.src = 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js';
document.head.appendChild(s);
