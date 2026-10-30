import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Building2,
  Eye,
  EyeOff,
  ShieldCheck,
  Globe2,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../lib/api";
export default function Auth({ mode = "login" }) {
  const isRegister = mode === "register";
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const { login, register } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (isRegister) {
        await register({
          name: form.name,
          email: form.email,
          password: form.password,
        });
        if (!localStorage.getItem("nri_token")) {
          setError(
            "Account created. Please sign in with your new credentials.",
          );
          return;
        }
      } else await login(form.email, form.password);
      nav(loc.state?.from?.pathname || "/dashboard", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-shell">
      <section className="auth-art">
        <div className="auth-art-overlay" />
        <div className="auth-brand">
          <div className="brand-mark">
            <Building2 size={22} />
          </div>
          <strong>
            Estate<span>Pro</span>
          </strong>
        </div>
        <div className="auth-art-content">
          <div className="eyebrow">
            <Globe2 size={15} /> YOUR HOME, ANYWHERE
          </div>
          <h1>
            Every property.
            <br />
            <em>Peace of mind.</em>
          </h1>
          <p>
            One thoughtful place to oversee your properties back home, from
            wherever life takes you.
          </p>
          <div className="auth-proof">
            <div className="proof-avatars">
              <span>R</span>
              <span>A</span>
              <span>M</span>
              <span>+</span>
            </div>
            <div>
              <strong>Built around your peace of mind</strong>
              <small>Stay connected to what matters.</small>
            </div>
          </div>
        </div>
        <div className="auth-art-foot">
          <span>
            <ShieldCheck size={15} /> Secure owner access
          </span>
          <span>India · Worldwide</span>
        </div>
      </section>
      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand">
            <div className="brand-mark">
              <Building2 size={20} />
            </div>
            <strong>
              Estate<span>Pro</span>
            </strong>
          </div>
          <div className="auth-heading">
            <div className="auth-icon">
              <Building2 size={21} />
            </div>
            <p className="eyebrow">WELCOME {isRegister ? "ABOARD" : "BACK"}</p>
            <h2>
              {isRegister ? "Create your account" : "Good to see you again."}
            </h2>
            <p>
              {isRegister
                ? "Set up your owner portal to bring your properties together."
                : "Sign in to your property workspace and pick up where you left off."}
            </p>
          </div>
          <form className="auth-form" onSubmit={submit}>
            {isRegister && (
              <label>
                Full name
                <input
                  name="name"
                  value={form.name}
                  onChange={change}
                  placeholder="e.g. Aanya Mehta"
                  autoComplete="name"
                  required
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={change}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <div className="password-input">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  value={form.password}
                  onChange={change}
                  placeholder="Enter your password"
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  aria-label="Toggle password visibility"
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {!isRegister && (
              <div className="form-options">
                <label className="remember">
                  <input type="checkbox" /> <span>Keep me signed in</span>
                </label>
                <span className="muted-small">Secure access</span>
              </div>
            )}
            {error && (
              <div
                className={`form-alert ${error.startsWith("Account created") ? "success" : ""}`}
              >
                {error}
              </div>
            )}
            <button className="primary-btn auth-submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : isRegister
                  ? "Create account"
                  : "Sign in to workspace"}{" "}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="auth-switch">
            {isRegister ? "Already have an account?" : "New to EstatePro?"}{" "}
            <Link to={isRegister ? "/login" : "/register"}>
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </div>
          <div className="auth-security">
            <ShieldCheck size={16} />
            <span>
              Your information is protected with secure authentication.
            </span>
          </div>
          <div className="auth-legal">
            By continuing, you agree to our <a href="#terms">Terms</a> and{" "}
            <a href="#privacy">Privacy Policy</a>.
          </div>
        </div>
      </section>
    </div>
  );
}
