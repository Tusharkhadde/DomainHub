import React,{useEffect,useState} from 'react';
import {Route,Routes,useNavigate} from 'react-router-dom';
import {api} from '../api.js';
import {Login} from './Auth.jsx';
import {Layout} from './components.jsx';
import {Admin,Auctions,Dashboard,DNS,Domains,Listings,Orders,Search,Transfers} from './pages.jsx';

export default function App(){
  const [user,setUser]=useState(null),[boot,setBoot]=useState(true);
  const navigate=useNavigate();
  useEffect(()=>{api.get('/auth/me').then(setUser).catch(()=>{}).finally(()=>setBoot(false));},[]);
  async function logout(){await api.post('/auth/logout');setUser(null);navigate('/');}
  if(boot)return <div className="loading">Loading Domain Hub...</div>;
  if(!user)return <Login onLogin={setUser}/>;
  return <Layout user={user} onLogout={logout}><Routes>
    <Route path="/" element={<Dashboard/>}/>
    <Route path="/search" element={<Search/>}/>
    <Route path="/domains" element={<Domains/>}/>
    <Route path="/dns" element={<DNS/>}/>
    <Route path="/transfers" element={<Transfers userId={user.id}/>}/>
    <Route path="/auctions" element={<Auctions kind="live"/>}/>
    <Route path="/bids" element={<Auctions kind="bids"/>}/>
    <Route path="/won" element={<Auctions kind="won"/>}/>
    <Route path="/listings" element={<Listings/>}/>
    <Route path="/orders" element={<Orders all={user.role==='ADMIN'}/>}/>
    <Route path="/admin" element={user.role==='ADMIN'?<Admin/>:<Dashboard/>}/>
    <Route path="/admin/tlds" element={user.role==='ADMIN'?<Admin/>:<Dashboard/>}/>
    <Route path="*" element={<Dashboard/>}/>
  </Routes></Layout>;
}

