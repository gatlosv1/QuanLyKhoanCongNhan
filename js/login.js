import { login, currentUser, isSetupDone, setupFirstAdmin, validUsername } from "./api.js";

const ERR = {
  'auth/invalid-credential': 'Sai tên đăng nhập hoặc mật khẩu',
  'auth/user-not-found': 'Sai tên đăng nhập hoặc mật khẩu',
  'auth/wrong-password': 'Sai tên đăng nhập hoặc mật khẩu',
  'auth/too-many-requests': 'Thử quá nhiều lần, vui lòng đợi một lúc',
  'auth/weak-password': 'Mật khẩu quá yếu (tối thiểu 6 ký tự)',
  'auth/email-already-in-use': 'Tên đăng nhập đã tồn tại',
  'auth/configuration-not-found': 'Chưa bật Authentication (Email/Password) trong Firebase Console',
  'auth/operation-not-allowed': 'Chưa bật đăng nhập Email/Password trong Firebase Console',
  'permission-denied': 'Tài khoản chưa được cấp quyền, hãy liên hệ admin',
};

window.app = () => ({
  username: '', password: '', name: '', msg: '', err: false, busy: false, setup: false,

  async init() {
    if (await currentUser()) return location.replace('tram-can.html');
    this.setup = !(await isSetupDone());
  },

  say(text, isErr = true) { this.msg = text; this.err = isErr; },

  async doLogin() {
    if (!validUsername(this.username.trim().toLowerCase())) return this.say('Tên đăng nhập không hợp lệ');
    this.busy = true;
    try {
      await login(this.username, this.password);
      if (!(await currentUser())) return this.say('Tài khoản chưa được cấp quyền, hãy liên hệ admin');
      location.replace('tram-can.html');
    } catch (e) { this.say(ERR[e.code] || 'Đăng nhập thất bại: ' + (e.code || e.message)); }
    finally { this.busy = false; }
  },

  async doSetup() {
    if (!validUsername(this.username.trim().toLowerCase())) return this.say('Tên đăng nhập 3-30 ký tự: a-z, 0-9, . _ -');
    this.busy = true;
    try { await setupFirstAdmin(this.username, this.password, this.name.trim()); location.replace('tram-can.html'); }
    catch (e) { this.say(ERR[e.code] || 'Thiết lập thất bại: ' + (e.code || e.message)); }
    finally { this.busy = false; }
  },
});

const s = document.createElement('script');
s.src = 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js';
document.head.appendChild(s);
