import { subscribeEmployees, saveEmployees, removeEmployee, requireUser, logout, ROLES, validUsername,
  createAccount, subscribeUsers, setUserRole, removeUser, manageableRoles, canManage } from "./api.js";

const me = await requireUser(['admin', 'dev']);   // chưa đăng nhập -> index.html, không đủ quyền -> trạm cân

const svgCache = new Map();
const validCode = c => c && !c.includes('/') && c !== '.' && c !== '..' && c.length <= 100;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SAMPLE = { code: 'NV001', name: 'Nguyễn Văn A', dept: 'Sản Xuất' };

window.app = () => ({
  me, roles: Object.fromEntries(Object.entries(ROLES).filter(([k]) => manageableRoles(me.role).includes(k))),
  users: [], busy: false, acc: { name: '', username: '', password: '', role: 'user' },
  canManage(u) { return canManage(me.role, u); },
  async signOut() { await logout(); location.replace('index.html'); },

  get sortedUsers() { return [...this.users].sort((a, b) => a.username.localeCompare(b.username)); },

  async addUser() {
    const username = this.acc.username.trim().toLowerCase();
    if (!validUsername(username)) return this.say('Tên đăng nhập 3-30 ký tự: a-z, 0-9, . _ -', true);
    if (this.acc.password.length < 6) return this.say('Mật khẩu tối thiểu 6 ký tự', true);
    this.busy = true;
    try {
      await createAccount({ username, password: this.acc.password, name: this.acc.name.trim(), role: this.acc.role }, me.role);
      this.say(`Đã tạo tài khoản ${username}`);
      this.acc = { name: '', username: '', password: '', role: 'user' };
    } catch (e) {
      this.say(e.code === 'auth/email-already-in-use' ? 'Tên đăng nhập đã tồn tại' : 'Tạo tài khoản thất bại: ' + (e.code || e.message), true);
    } finally { this.busy = false; }
  },

  async changeRole(u, role) {
    if (!this.canManage(u) || !manageableRoles(me.role).includes(role)) return this.say('Không đủ quyền', true);
    try { await setUserRole(u.uid, role); this.say(`Đã đổi quyền ${u.username}`); }
    catch (e) { this.say('Đổi quyền thất bại', true); }
  },

  async delUser(u) {
    if (!this.canManage(u)) return this.say('Không đủ quyền', true);
    if (!confirm(`Xóa tài khoản ${u.username}?`)) return;
    try { await removeUser(u.uid); this.say('Đã xóa tài khoản'); } catch (e) { this.say('Xóa thất bại', true); }
  },
  list: [], q: '', form: { code: '', name: '', dept: '' }, bulk: '',
  msg: '', err: false, printCode: '',

  get preview() {
    const f = this.form;
    return (f.code || f.name || f.dept) ? { code: f.code.trim(), name: f.name.trim(), dept: f.dept.trim() } : SAMPLE;
  },

  get printList() {
    return this.printCode ? this.list.filter(e => e.code === this.printCode) : this.filtered;
  },

  cardHtml(e) {
    return `<div class="card">
      <div class="card-head">
        <div class="card-company">Công ty cổ phần tập đoàn xuất<br>nhập khẩu trái cây Chánh Thu</div>
      </div>
      <div class="card-qr">${e.code ? this.svg(e.code) : ''}</div>
      <div class="card-code">${esc(e.code)}</div>
      <div class="card-title">Thẻ nhân viên</div>
      <div class="card-field card-name">Họ Tên: ${esc(e.name)}</div>
      <div class="card-field card-dept">Bộ Phận: ${esc(e.dept)}</div>
      <div class="card-line"></div>
    </div>`;
  },

  init() {
    subscribeEmployees(l => { this.list = l; }, () => this.say('Không đọc được Firestore, kiểm tra cấu hình/quyền', true));
    subscribeUsers(l => { this.users = l; }, () => this.say('Không đọc được danh sách tài khoản', true));
    addEventListener('afterprint', () => { this.printCode = ''; });
  },

  get filtered() {
    const k = this.q.trim().toLowerCase();
    return this.list
      .filter(e => !k || [e.code, e.name, e.dept].some(v => String(v || '').toLowerCase().includes(k)))
      .sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }));
  },

  svg(code) {
    if (!svgCache.has(code)) {
      const qr = qrcode(0, 'M');
      qr.addData(code, 'Byte');
      qr.make();
      svgCache.set(code, qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true }));   // margin 16 = 4 module viền trắng
    }
    return svgCache.get(code);
  },

  say(text, isErr = false) {
    this.msg = text; this.err = isErr;
    clearTimeout(this._t); this._t = setTimeout(() => { this.msg = ''; }, 3500);
  },

  async add() {
    const e = { code: this.form.code.trim(), name: this.form.name.trim(), dept: this.form.dept.trim() };
    if (!validCode(e.code) || !e.name) return this.say('Mã không hợp lệ (không chứa "/") hoặc thiếu tên', true);
    try { await saveEmployees([e]); this.say(`Đã lưu ${e.name} (${e.code})`); this.form = { code: '', name: '', dept: '' }; }
    catch (x) { this.say('Lưu thất bại, kiểm tra mạng/quyền Firestore', true); }
  },

  async importBulk() {
    const seen = new Set(), items = [];
    let bad = 0;
    for (const line of this.bulk.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const [code = '', name = '', dept = ''] = line.split(/[,;\t]/).map(s => s.trim());
      if (!validCode(code) || !name) { bad++; continue; }
      if (!seen.has(code)) { seen.add(code); items.push({ code, name, dept }); }
    }
    if (!items.length) return this.say('Không có dòng hợp lệ (cần: mã, họ tên, bộ phận)', true);
    try { await saveEmployees(items); this.bulk = ''; this.say(`Đã nhập ${items.length} nhân viên` + (bad ? `, bỏ qua ${bad} dòng lỗi` : '')); }
    catch (x) { this.say('Nhập thất bại, kiểm tra mạng/quyền Firestore', true); }
  },

  edit(e) { this.form = { code: e.code, name: e.name, dept: e.dept || '' }; scrollTo({ top: 0, behavior: 'smooth' }); },

  async del(e) {
    if (!confirm(`Xóa ${e.name} (${e.code})?`)) return;
    try { await removeEmployee(e.code); this.say('Đã xóa'); } catch (x) { this.say('Xóa thất bại', true); }
  },

  printAll() { this.printCode = ''; this.$nextTick(() => print()); },
  printOne(code) { this.printCode = code; this.$nextTick(() => print()); },
});

// Nạp Alpine sau khi app() đã sẵn sàng
const s = document.createElement('script');
s.src = 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js';
document.head.appendChild(s);
