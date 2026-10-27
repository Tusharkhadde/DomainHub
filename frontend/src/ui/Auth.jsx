import React,{useState}from'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {api} from '../api.js';

export function Login({onLogin,mode='login'}){
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const signup=mode==='register';
  const location=useLocation();
  const navigate=useNavigate();

  async function submit(event){
    event.preventDefault();
    setError('');
    setBusy(true);
    const form=new FormData(event.currentTarget);
    try{
      const user=await api.post(`/auth/${signup?'register':'login'}`,Object.fromEntries(form));
      if(signup)await api.post('/auth/login',{email:form.get('email'),password:form.get('password')});
      onLogin(user);
      navigate(location.state?.domain?'/search':'/',{replace:true,state:location.state?.domain?{domain:location.state.domain}:undefined});
    }catch(requestError){
      setError(requestError.message);
    }finally{
      setBusy(false);
    }
  }

  return <main className="auth-page">
    <div className="auth-aside">
      <Link className="auth-home" to="/"><span className="site-brand-icon">D<span /></span><span>domain hub</span></Link>
      <div className="auth-aside-copy"><span className="section-index">YOUR DOMAIN WORK, IN ONE PLACE</span><h1>Make room<br />for what’s next.</h1><p>Keep the names, records and handoffs that matter close at hand.</p></div>
      <span className="auth-aside-foot">A clearer view of your domain workspace.</span>
    </div>
    <section className="auth-main">
      <Link className="auth-back" to="/">← Back to home</Link>
      <form className="auth-form" onSubmit={submit}>
        <span className="section-index">{signup?'GET STARTED':'WELCOME BACK'}</span>
        <h2>{signup?'Create your account':'Sign in'}</h2>
        <p>{signup?'Start organizing your domain work in one place.':'Continue to your Domain Hub workspace.'}</p>
        {signup&&<label>Your name<input name="name" required autoComplete="name" placeholder="Name"/></label>}
        <label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@example.com"/></label>
        <label>Password<input name="password" type="password" minLength="8" required autoComplete={signup?'new-password':'current-password'} placeholder="At least 8 characters"/></label>
        {error&&<div className="error" role="alert">{error}</div>}
        <button className="button button-blue auth-submit" disabled={busy}>{busy?(signup?'Creating account…':'Signing in…'):(signup?'Create account':'Sign in')}<span>↗</span></button>
        <div className="auth-switch">{signup?'Already have an account?':'New to Domain Hub?'} <Link to={signup?'/login':'/register'} state={location.state}>{signup?'Sign in':'Create an account'}</Link></div>
      </form>
      <p className="auth-disclaimer">Your account is for this Domain Hub workspace. It does not create an account with an external domain registrar.</p>
    </section>
  </main>;
}
