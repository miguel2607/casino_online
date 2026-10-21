import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import Cat, { CAT_COLORS } from '../components/Cat.jsx';
import { StarIcon } from '../components/Icons.jsx';

const COLOR_NAMES = { orange: 'Naranja', gray: 'Gris', black: 'Negrito', white: 'Blanco', calico: 'Calicó', cream: 'Crema' };

const SUBTITLE = {
  login: 'Bienvenida de vuelta, te extrañamos',
  register: 'Crea tu cuenta y recibe estrellitas de regalo',
  recover: 'Responde la pregunta secreta y elige una contraseña nueva',
};

export default function Login() {
  const { login, register, recover } = useAuth();
  const [mode, setMode] = useState('login'); // login | register | recover
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [recovery, setRecovery] = useState({ enabled: false });
  const [form, setForm] = useState({ username: '', password: '', confirm: '', displayName: '', avatar: 'calico', answer: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/auth/config').then((c) => setAllowRegistration(c.allowRegistration)).catch(() => {});
    api('/auth/recovery').then(setRecovery).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const go = (m) => {
    setMode(m);
    setError('');
    setForm((f) => ({ ...f, password: '', confirm: '', answer: '' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'recover') {
      if (!form.answer) return setError('Elige una respuesta');
      if (form.password !== form.confirm) return setError('Las contraseñas no coinciden');
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(form.username, form.password);
      else if (mode === 'register') await register(form);
      else await recover({ username: form.username, answer: form.answer, newPassword: form.password });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const isRegister = mode === 'register';
  const isRecover = mode === 'recover';

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
            <Cat
              color={isRegister ? form.avatar : 'orange'}
              mood={isRecover ? 'shocked' : 'love'}
              size={92}
              className="auth-cat-main"
            />
            <Cat color="black" mood="happy" size={64} />
          </div>
          <h1>
            Michi<b>Casino</b>
          </h1>
          <p>{SUBTITLE[mode]}</p>
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

          {isRecover && (
            <div className="field">
              <span>{recovery.question}</span>
              <div className="recovery-options" role="radiogroup">
                {recovery.options.map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    role="radio"
                    aria-checked={form.answer === opt}
                    className={`recovery-option ${form.answer === opt ? 'is-active' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, answer: opt }))}
                  >
                    <span aria-hidden="true">⚽</span> {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="field">
            <span>{isRecover ? 'Contraseña nueva' : 'Contraseña'}</span>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={form.password}
              onChange={set('password')}
              placeholder="••••••"
              required
            />
          </label>

          {isRecover && (
            <label className="field">
              <span>Repite la contraseña nueva</span>
              <input type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} placeholder="••••••" required />
            </label>
          )}

          {mode === 'login' && recovery.enabled && (
            <button type="button" className="link-btn forgot-link" onClick={() => go('recover')}>
              ¿Olvidaste tu contraseña?
            </button>
          )}

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
            {busy ? 'Un momento…' : isRecover ? 'Cambiar contraseña y entrar' : isRegister ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>

        {isRecover ? (
          <p className="auth-switch">
            ¿Ya la recordaste?{' '}
            <button type="button" className="link-btn" onClick={() => go('login')}>
              Volver a iniciar sesión
            </button>
          </p>
        ) : (
          (allowRegistration || isRegister) && (
            <p className="auth-switch">
              {isRegister ? '¿Ya tienes cuenta?' : '¿Primera vez aquí?'}{' '}
              <button type="button" className="link-btn" onClick={() => go(isRegister ? 'login' : 'register')}>
                {isRegister ? 'Inicia sesión' : 'Crea tu cuenta'}
              </button>
            </p>
          )
        )}
      </div>
    </div>
  );
}
