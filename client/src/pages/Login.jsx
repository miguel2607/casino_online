import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import Cat, { CAT_COLORS } from '../components/Cat.jsx';
import { StarIcon } from '../components/Icons.jsx';

const COLOR_NAMES = { orange: 'Naranja', gray: 'Gris', black: 'Negrito', white: 'Blanco', calico: 'Calicó', cream: 'Crema' };

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [form, setForm] = useState({ username: '', password: '', displayName: '', avatar: 'calico' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/auth/config').then((c) => setAllowRegistration(c.allowRegistration)).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(form.username, form.password);
      else await register(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <div className="auth-page">
      <div className="auth-deco" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <StarIcon key={i} size={10 + ((i * 7) % 18)} className={`twinkle twinkle-${i % 5}`} />
        ))}
      </div>

      <div className="auth-card">
        <div className="auth-hero">
          <div className="auth-cats">
            <Cat color="gray" mood="wink" size={64} />
            <Cat color={isRegister ? form.avatar : 'orange'} mood="love" size={92} className="auth-cat-main" />
            <Cat color="black" mood="happy" size={64} />
          </div>
          <h1>
            Michi<b>Casino</b>
          </h1>
          <p>{isRegister ? 'Crea tu cuenta y recibe estrellitas de regalo' : 'Bienvenida de vuelta, te extrañamos'}</p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label className="field">
            <span>Usuario</span>
            <input
              autoFocus
              autoComplete="username"
              value={form.username}
              onChange={set('username')}
              placeholder="tu_usuario"
              required
            />
          </label>
          {isRegister && (
            <label className="field">
              <span>¿Cómo te llamamos?</span>
              <input value={form.displayName} onChange={set('displayName')} placeholder="Tu nombre o apodo" />
            </label>
          )}
          <label className="field">
            <span>Contraseña</span>
            <input
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={set('password')}
              placeholder="••••••"
              required
            />
          </label>

          {isRegister && (
            <div className="field">
              <span>Elige tu michi</span>
              <div className="avatar-picker">
                {CAT_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={`avatar-option ${form.avatar === c ? 'is-active' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, avatar: c }))}
                    title={COLOR_NAMES[c]}
                  >
                    <Cat color={c} size={40} mood={form.avatar === c ? 'happy' : 'normal'} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? 'Un momento…' : isRegister ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>

        {(allowRegistration || isRegister) && (
          <p className="auth-switch">
            {isRegister ? '¿Ya tienes cuenta?' : '¿Primera vez aquí?'}{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setMode(isRegister ? 'login' : 'register');
                setError('');
              }}
            >
              {isRegister ? 'Inicia sesión' : 'Crea tu cuenta'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
